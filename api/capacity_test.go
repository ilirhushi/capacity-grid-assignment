package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCapacityRejectsInvalidRanges(t *testing.T) {
	tests := []string{
		"/api/capacity",
		"/api/capacity?from=2026-02-30&to=2026-03-01",
		"/api/capacity?from=2026-01-12&to=2026-01-11",
		"/api/capacity?from=2025-01-01&to=2028-01-01",
	}
	for _, path := range tests {
		t.Run(path, func(t *testing.T) {
			response := httptest.NewRecorder()
			(&server{}).handleCapacity(response, httptest.NewRequest(http.MethodGet, path, nil))
			if response.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", response.Code)
			}
		})
	}
}
