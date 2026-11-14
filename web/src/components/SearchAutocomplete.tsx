"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  ArrowRight,
  Clock,
  BookOpen,
  Sparkles,
  GraduationCap,
  X,
  Loader2,
} from "lucide-react";
import { SuggestionItem, fetchSearchSuggestions } from "@/lib/api";

const RECENT_SEARCHES_KEY = "studyhub_recent_searches";
const MAX_RECENT_SEARCHES = 5;

export interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (term: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  id?: string;
  buttonLabel?: string;
  showButton?: boolean;
}

export default function SearchAutocomplete({
  value,
  onChange,
  onSubmit,
  placeholder = "Search courses, past exams, lecture notes, or codes (e.g. DBMS, Calculus)...",
  autoFocus = false,
  className = "",
  id = "studyhub-search-autocomplete",
  buttonLabel = "Search",
  showButton = true,
}: SearchAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES));
        }
      }
    } catch (_) {
      // LocalStorage not available or corrupted
    }
  }, []);

  // Save term to recent searches
  const saveRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    try {
      setRecentSearches((prev) => {
        const updated = [trimmed, ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(
          0,
          MAX_RECENT_SEARCHES
        );
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (_) {}
  }, []);

  // Remove individual recent search item
  const removeRecentSearch = useCallback((e: React.MouseEvent, itemToRemove: string) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      setRecentSearches((prev) => {
        const updated = prev.filter((item) => item.toLowerCase() !== itemToRemove.toLowerCase());
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        return updated;
      });
      // Also remove from current suggestions list if displayed
      setSuggestions((prev) => prev.filter((s) => !(s.type === "recent" && s.text === itemToRemove)));
    } catch (_) {}
  }, []);

  // Fetch suggestions with debouncing and aborting
  const fetchSuggestionsForQuery = useCallback(
    (query: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const trimmed = query.trim();

      // If empty, show recent searches + initial popular suggestions
      if (!trimmed) {
        setIsLoading(false);
        const initialItems: SuggestionItem[] = [];

        // 1. Add recent searches
        recentSearches.forEach((recent) => {
          initialItems.push({ text: recent, type: "recent" });
        });

        // 2. Add fallback top popular suggestions
        const popularDefaults: SuggestionItem[] = [
          { text: "DBMS Exam", type: "popular" },
          { text: "DSA Final Exam", type: "popular" },
          { text: "Computer Networks", type: "popular" },
          { text: "Calculus I Past Exam", type: "popular" },
          { text: "Operating Systems", type: "popular" },
          { text: "Software Engineering", type: "popular" },
        ];

        popularDefaults.forEach((pop) => {
          if (
            initialItems.length < 6 &&
            !initialItems.some((item) => item.text.toLowerCase() === pop.text.toLowerCase())
          ) {
            initialItems.push(pop);
          }
        });

        setSuggestions(initialItems);
        return;
      }

      // If query is typed, wait 250ms debounce then fetch from API
      setIsLoading(true);
      debounceTimerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          const apiSuggestions = await fetchSearchSuggestions(trimmed, controller.signal);

          // Prepend any matching recent search if relevant
          const matchingRecent = recentSearches
            .filter(
              (r) =>
                r.toLowerCase().includes(trimmed.toLowerCase()) &&
                !apiSuggestions.some((s) => s.text.toLowerCase() === r.toLowerCase())
            )
            .slice(0, 2)
            .map((r): SuggestionItem => ({ text: r, type: "recent" }));

          const combined = [...matchingRecent, ...apiSuggestions].slice(0, 6);
          setSuggestions(combined);
          setSelectedIndex(-1);
        } catch (err: any) {
          if (err.name !== "AbortError") {
            setSuggestions([]);
          }
        } finally {
          setIsLoading(false);
        }
      }, 250);
    },
    [recentSearches]
  );

  // Trigger suggestions update when value changes
  useEffect(() => {
    if (isOpen) {
      fetchSuggestionsForQuery(value);
    }
  }, [value, isOpen, fetchSuggestionsForQuery]);

  // Click outside listener to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const handleFocus = () => {
    setIsOpen(true);
    fetchSuggestionsForQuery(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleSelectSuggestion = (item: SuggestionItem) => {
    const text = item.text;
    onChange(text);
    saveRecentSearch(text);
    setIsOpen(false);
    setSelectedIndex(-1);
    onSubmit(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Enter") {
        if (value.trim()) {
          saveRecentSearch(value.trim());
        }
        onSubmit(value.trim());
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else {
        const trimmed = value.trim();
        if (trimmed) {
          saveRecentSearch(trimmed);
        }
        setIsOpen(false);
        onSubmit(trimmed);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      handleSelectSuggestion(suggestions[selectedIndex]);
    } else {
      const trimmed = value.trim();
      if (trimmed) {
        saveRecentSearch(trimmed);
      }
      setIsOpen(false);
      onSubmit(trimmed);
    }
  };

  // Renders highlighted text matching the user query
  const renderHighlightedText = (text: string, query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      return <span>{text}</span>;
    }

    const regex = new RegExp(`(${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);

    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === trimmed.toLowerCase() ? (
            <mark key={i} className="autocomplete-highlight">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  // Helper for suggestion icon and label
  const getBadgeDetails = (type: SuggestionItem["type"]) => {
    switch (type) {
      case "recent":
        return { label: "Recent", icon: <Clock size={14} className="autocomplete-icon-recent" /> };
      case "subject":
        return { label: "Subject", icon: <BookOpen size={14} className="autocomplete-icon-subject" /> };
      case "course":
        return { label: "Course", icon: <GraduationCap size={14} className="autocomplete-icon-course" /> };
      case "popular":
      default:
        return { label: "Popular", icon: <Sparkles size={14} className="autocomplete-icon-popular" /> };
    }
  };

  return (
    <div ref={containerRef} className={`search-autocomplete-wrapper ${className}`}>
      <form
        className="searchbar"
        onSubmit={handleSubmit}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-owns={`${id}-listbox`}
      >
        <span className="search-icon">
          {isLoading ? (
            <Loader2 size={20} className="animate-spin text-primary" />
          ) : (
            <Search size={20} />
          )}
        </span>

        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          aria-activedescendant={
            selectedIndex >= 0 ? `${id}-option-${selectedIndex}` : undefined
          }
          aria-label={placeholder}
        />

        {value.trim() && (
          <button
            type="button"
            className="autocomplete-clear-btn"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search input"
          >
            <X size={16} />
          </button>
        )}

        {showButton && (
          <button type="submit" className="btn btn-primary">
            <span>{buttonLabel}</span>
            <ArrowRight size={15} />
          </button>
        )}
      </form>

      {/* Dropdown Suggestions List */}
      {isOpen && suggestions.length > 0 && (
        <ul
          id={`${id}-listbox`}
          className="autocomplete-dropdown"
          role="listbox"
          aria-label="Search suggestions"
        >
          {suggestions.map((item, idx) => {
            const isSelected = selectedIndex === idx;
            const badge = getBadgeDetails(item.type);

            return (
              <li
                key={`${item.type}-${item.text}-${idx}`}
                id={`${id}-option-${idx}`}
                role="option"
                aria-selected={isSelected}
                className={`autocomplete-item ${isSelected ? "selected" : ""}`}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => handleSelectSuggestion(item)}
              >
                <div className="autocomplete-item-left">
                  <span className="autocomplete-type-icon">{badge.icon}</span>
                  <span className="autocomplete-item-text">
                    {renderHighlightedText(item.text, value)}
                  </span>
                </div>

                <div className="autocomplete-item-right">
                  <span className={`autocomplete-badge badge-${item.type}`}>
                    {badge.label}
                  </span>
                  {item.type === "recent" && (
                    <button
                      type="button"
                      className="autocomplete-remove-btn"
                      onClick={(e) => removeRecentSearch(e, item.text)}
                      title="Remove from recent searches"
                      aria-label={`Remove ${item.text} from history`}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
