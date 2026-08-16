package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

type GenerateRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
}

type OllamaResponse struct {
	Response string `json:"response"`
	Done     bool   `json:"done"`
}

type ClientMessage struct {
	Type   string `json:"type"` // "chat", "ping"
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
}

type ServerMessage struct {
	Type    string `json:"type"` // "token", "done", "error", "pong"
	Text    string `json:"text,omitempty"`
	Message string `json:"message,omitempty"`
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func main() {
	port := getEnv("AI_BRIDGE_PORT", "8765")
	ollamaHost := getEnv("OLLAMA_HOST", "http://127.0.0.1:11434")

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status": "ok",
			"ollama": ollamaHost,
			"engine": "go-native",
		})
	})

	http.HandleFunc("/api/chat", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req ClientMessage
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"type":"error","message":"invalid json"}`, http.StatusBadRequest)
			return
		}

		if req.Prompt == "" {
			http.Error(w, `{"type":"error","message":"prompt is required"}`, http.StatusBadRequest)
			return
		}

		model := req.Model
		if model == "" {
			model = "llama3"
		}

		ollamaReq := GenerateRequest{
			Model:  model,
			Prompt: req.Prompt,
			Stream: true,
		}

		reqBody, _ := json.Marshal(ollamaReq)
		resp, err := http.Post(ollamaHost+"/api/generate", "application/json", bytes.NewBuffer(reqBody))
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"type":"error","message":"ollama error: %v"}`, err), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
			return
		}

		reader := bufio.NewReader(resp.Body)
		for {
			line, err := reader.ReadBytes('\n')
			if len(line) > 0 {
				var oResp OllamaResponse
				if errJson := json.Unmarshal(line, &oResp); errJson == nil {
					if oResp.Response != "" {
						msg, _ := json.Marshal(ServerMessage{Type: "token", Text: oResp.Response})
						fmt.Fprintf(w, "data: %s\n\n", msg)
						flusher.Flush()
					}
					if oResp.Done {
						msg, _ := json.Marshal(ServerMessage{Type: "done"})
						fmt.Fprintf(w, "data: %s\n\n", msg)
						flusher.Flush()
						break
					}
				}
			}
			if err != nil {
				if err != io.EOF {
					log.Printf("Stream error: %v", err)
				}
				break
			}
		}
	})

	server := &http.Server{
		Addr:         ":" + port,
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
	}

	log.Printf("🤖 CyberSec Pro AI Bridge (Go Native) listening on :%s -> %s", port, ollamaHost)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed: %v", err)
	}
}
