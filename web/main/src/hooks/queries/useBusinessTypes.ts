import { useQuery } from "@tanstack/react-query";

import { getBusinessTypes } from "@/services/verticals";

export function useBusinessTypes() {
  return useQuery({
    queryKey: ["business-types"],
    queryFn: getBusinessTypes,
    staleTime: Infinity, // static reference data
  });
}
