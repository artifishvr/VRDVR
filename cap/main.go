package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"
)

var defaultRelative = []string{"AppData", "LocalLow", "VRChat", "VRChat"}

// Deduplication cache
var (
	seenStreams   = make(map[string]time.Time)
	seenStreamsMu sync.Mutex
	dedupWindow   = 30 * time.Second
)

// getDefaultLogDir returns the default VRChat log directory
func getDefaultLogDir() string {
	userProfile := os.Getenv("USERPROFILE")
	if userProfile == "" {
		userProfile = os.Getenv("HOME")
	}
	if userProfile == "" {
		return "."
	}
	return filepath.Join(append([]string{userProfile}, defaultRelative...)...)
}

func isLogFile(name string) bool {
	// VRChat logs are typically named output_log.txt or output_log_YYYY-MM-DD_HH-MM-SS.txt
	matched, _ := regexp.MatchString(`(?i)^output_log.*\.txt$`, name)
	return matched
}

func findNewestLog(dir string) (string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", err
	}

	var newest string
	var newestTime time.Time

	for _, entry := range entries {
		if !isLogFile(entry.Name()) {
			continue
		}

		fullPath := filepath.Join(dir, entry.Name())
		info, err := os.Stat(fullPath)
		if err != nil {
			continue
		}

		if !info.IsDir() && (newest == "" || info.ModTime().After(newestTime)) {
			newest = fullPath
			newestTime = info.ModTime()
		}
	}

	if newest == "" {
		return "", fmt.Errorf("no log files found")
	}

	return newest, nil
}

func extractVrcdnStream(line string) string {
	// Match either "Resolving URL" or "Attempting to resolve URL"
	re := regexp.MustCompile(`(?i)(?:Attempting to resolve|Resolving)\s+URL\s+['"]([^'"]+)['"]`)
	matches := re.FindStringSubmatch(line)
	if len(matches) < 2 {
		return ""
	}

	url := matches[1]

	if strings.Contains(url, "vr-m.net") {
		fmt.Println("nya.llc btw")
	}

	if !strings.Contains(strings.ToLower(url), "vrcdn.live") {
		return ""
	}

	// Grab last non-empty path segment
	parts := strings.Split(url, "/")
	var lastPart string
	for i := len(parts) - 1; i >= 0; i-- {
		if parts[i] != "" {
			lastPart = parts[i]
			break
		}
	}

	if lastPart == "" {
		return ""
	}

	return strings.Replace(lastPart, ".live.ts", "", -1)
}

func shouldProcessStream(streamName string) bool {
	seenStreamsMu.Lock()
	defer seenStreamsMu.Unlock()

	lastSeen, exists := seenStreams[streamName]
	now := time.Now()

	if !exists || now.Sub(lastSeen) > dedupWindow {
		seenStreams[streamName] = now
		// Clean up old entries (older than dedupWindow)
		for name, timestamp := range seenStreams {
			if now.Sub(timestamp) > dedupWindow {
				delete(seenStreams, name)
			}
		}
		return true
	}

	return false
}

func onVrcdnStreamDetected(streamName string) {
	if !shouldProcessStream(streamName) {
		return
	}

	fmt.Printf("VRCDN stream detected: %s\n", streamName)

	requestBody, err := json.Marshal(map[string]string{
		"user": streamName,
	})
	if err != nil {
		fmt.Println("Error marshaling request:", err)
		return
	}

	resp, err := http.Post(
		"https://api.dvr.vrc.bz/record",
		"application/json",
		bytes.NewBuffer(requestBody),
	)
	if err != nil {
		fmt.Println("Error sending fetch request:", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("Fetch response: %s\n", string(body))
}

func tailFile(filePath string, onLine func(string), stopCh <-chan struct{}) error {
	// Start at end of file (only new lines)
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	// Seek to end of file
	_, err = file.Seek(0, io.SeekEnd)
	if err != nil {
		return err
	}

	reader := bufio.NewReader(file)
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-stopCh:
			return nil
		case <-ticker.C:
			// Try to read new lines
			for {
				line, err := reader.ReadString('\n')
				if err != nil {
					if err != io.EOF {
						// Real error, but continue
					}
					break
				}
				line = strings.TrimSpace(line)
				if len(line) > 0 {
					onLine(line)
				}
			}
		}
	}
}

func main() {
	logDir := getDefaultLogDir()

	currentFile, err := findNewestLog(logDir)
	if err != nil {
		fmt.Println("No log files found yet. Will watch directory for new logs...")
	} else {
		fmt.Println("Tailing newest log:", currentFile)
	}

	// Setup signal handling
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)

	stopCh := make(chan struct{})
	doneCh := make(chan struct{})

	// Start tailing if we have a file
	if currentFile != "" {
		go func() {
			err := tailFile(currentFile, func(line string) {
				streamName := extractVrcdnStream(line)
				if streamName != "" {
					onVrcdnStreamDetected(streamName)
				}
			}, stopCh)
			if err != nil {
				fmt.Println("Error tailing file:", err)
			}
		}()
	}

	// Watch for new log files in directory
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		lastChecked := currentFile

		for {
			select {
			case <-stopCh:
				doneCh <- struct{}{}
				return
			case <-ticker.C:
				newest, err := findNewestLog(logDir)
				if err == nil && newest != lastChecked {
					fmt.Println("Switching to newer log:", newest)
					// Stop old tail
					close(stopCh)
					stopCh = make(chan struct{})
					lastChecked = newest
					currentFile = newest

					// Start new tail
					go func() {
						err := tailFile(currentFile, func(line string) {
							streamName := extractVrcdnStream(line)
							if streamName != "" {
								onVrcdnStreamDetected(streamName)
							}
						}, stopCh)
						if err != nil {
							fmt.Println("Error tailing file:", err)
						}
					}()
				}
			}
		}
	}()

	// Wait for interrupt
	<-sigCh
	fmt.Println("\nStopping...")
	close(stopCh)
	<-doneCh
	fmt.Println("Stopped")
}
