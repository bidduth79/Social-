import { useState, useEffect, useCallback } from 'react';

const VISITED_LINKS_KEY = 'visited_links_timestamps';
const VISIT_COUNTS_KEY = 'visited_links_counts';
const EXPIRY_TIME = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

export function useVisitedLinks() {
  const [visitedLinks, setVisitedLinks] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(VISITED_LINKS_KEY);
    if (!saved) return {};
    try {
      const parsed = JSON.parse(saved);
      const now = Date.now();
      const filtered: Record<string, number> = {};
      Object.entries(parsed).forEach(([id, timestamp]) => {
        if (now - (timestamp as number) < EXPIRY_TIME) {
          filtered[id] = timestamp as number;
        }
      });
      return filtered;
    } catch (e) {
      return {};
    }
  });

  const [visitCounts, setVisitCounts] = useState<Record<string, number>>(() => {
    const savedCounts = localStorage.getItem(VISIT_COUNTS_KEY);
    const savedVisited = localStorage.getItem(VISITED_LINKS_KEY);
    if (!savedCounts || !savedVisited) return {};
    try {
      const counts = JSON.parse(savedCounts);
      const visited = JSON.parse(savedVisited);
      const now = Date.now();
      const filtered: Record<string, number> = {};
      
      Object.entries(visited).forEach(([id, timestamp]) => {
        if (now - (timestamp as number) < EXPIRY_TIME && counts[id]) {
          filtered[id] = counts[id];
        }
      });
      return filtered;
    } catch (e) {
      return {};
    }
  });

  const markAsVisited = useCallback((id: string) => {
    const now = Date.now();
    
    setVisitedLinks(prev => {
      const updated = { ...prev, [id]: now };
      localStorage.setItem(VISITED_LINKS_KEY, JSON.stringify(updated));
      return updated;
    });

    setVisitCounts(prev => {
      const updated = { ...prev, [id]: (prev[id] || 0) + 1 };
      localStorage.setItem(VISIT_COUNTS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isVisited = useCallback((id: string) => {
    const timestamp = visitedLinks[id];
    if (!timestamp) return false;
    return Date.now() - timestamp < EXPIRY_TIME;
  }, [visitedLinks]);

  const getVisitCount = useCallback((id: string) => {
    return visitCounts[id] || 0;
  }, [visitCounts]);

  // Periodically clean up expired links and their counts
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let hasChanges = false;
      
      setVisitedLinks(prevVisited => {
        const filteredVisited: Record<string, number> = {};
        Object.entries(prevVisited).forEach(([id, timestamp]) => {
          if (now - timestamp < EXPIRY_TIME) {
            filteredVisited[id] = timestamp;
          } else {
            hasChanges = true;
          }
        });
        
        if (hasChanges) {
          localStorage.setItem(VISITED_LINKS_KEY, JSON.stringify(filteredVisited));
          
          setVisitCounts(prevCounts => {
            const filteredCounts: Record<string, number> = {};
            Object.keys(filteredVisited).forEach(id => {
              if (prevCounts[id]) filteredCounts[id] = prevCounts[id];
            });
            localStorage.setItem(VISIT_COUNTS_KEY, JSON.stringify(filteredCounts));
            return filteredCounts;
          });
          
          return filteredVisited;
        }
        return prevVisited;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return { markAsVisited, isVisited, getVisitCount };
}
