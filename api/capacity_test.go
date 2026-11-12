package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
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

func capacityTestServer(t *testing.T) *server {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL is required for the seeded integration test")
	}
	db, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	return &server{db: db}
}

func getCapacity(t *testing.T, s *server, path string) (int, capacityResponse) {
	t.Helper()
	response := httptest.NewRecorder()
	s.handleCapacity(response, httptest.NewRequest(http.MethodGet, path, nil))
	var body capacityResponse
	if response.Code == http.StatusOK {
		if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
	}
	return response.Code, body
}

func TestCapacitySeededWeeks(t *testing.T) {
	s := capacityTestServer(t)
	status, body := getCapacity(t, s, "/api/capacity?from=2025-12-29&to=2026-01-16")
	if status != http.StatusOK {
		t.Fatalf("status = %d", status)
	}
	if len(body.Weeks) != 3 || body.Weeks[0] != "2025-12-29" || body.Weeks[2] != "2026-01-12" {
		t.Fatalf("weeks = %v", body.Weeks)
	}
	want := map[int][]float64{1: {320, 0, 240}, 2: {0, 256, 64}, 4: {0, 360, 320}, 5: {0, 160, 0}}
	for _, person := range body.People {
		if allocated, ok := want[person.ID]; ok {
			for i, hours := range allocated {
				if person.Allocated[i] != hours {
					t.Errorf("person %d week %d = %v, want %v", person.ID, i, person.Allocated[i], hours)
				}
			}
			delete(want, person.ID)
		}
	}
	if len(want) != 0 {
		t.Fatalf("people missing: %v", want)
	}
}

func TestCapacitySearchAndPage(t *testing.T) {
	s := capacityTestServer(t)
	status, body := getCapacity(t, s, "/api/capacity?from=2025-12-29&to=2026-01-16&search=Sanne&page=2&pageSize=3")
	if status != http.StatusOK {
		t.Fatalf("status = %d", status)
	}
	if body.Page != 2 || body.PageSize != 3 || body.TotalPeople != 8 || len(body.People) != 3 {
		t.Fatalf("page = %d, size = %d, total = %d, people = %d", body.Page, body.PageSize, body.TotalPeople, len(body.People))
	}
	for _, person := range body.People {
		if len(person.Allocated) != len(body.Weeks) {
			t.Fatalf("person %d has %d allocations for %d weeks", person.ID, len(person.Allocated), len(body.Weeks))
		}
	}
	status, literal := getCapacity(t, s, "/api/capacity?from=2025-12-29&to=2026-01-16&search=%25")
	if status != http.StatusOK || literal.TotalPeople != 0 || len(literal.People) != 0 {
		t.Fatalf("literal search: status %d, total %d, rows %d", status, literal.TotalPeople, len(literal.People))
	}
}

func TestCapacityRejectsInvalidPaging(t *testing.T) {
	for _, query := range []string{"page=0", "page=nope", "pageSize=0", "pageSize=101"} {
		t.Run(query, func(t *testing.T) {
			status, _ := getCapacity(t, &server{}, "/api/capacity?from=2025-12-29&to=2026-01-16&"+query)
			if status != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", status)
			}
		})
	}
}
