import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Safe back navigation hook with fallback route.
 * Uses browser history when available, falls back to explicit route otherwise.
 */
export function useGoBack(fallback = "/") {
  const navigate = useNavigate();

  return useCallback(() => {
    // React Router stores the history index in window.history.state
    // If idx is 0 or missing, there's no previous page in the SPA history
    const historyIdx = window.history.state?.idx;
    if (typeof historyIdx === "number" && historyIdx > 0) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  }, [navigate, fallback]);
}
