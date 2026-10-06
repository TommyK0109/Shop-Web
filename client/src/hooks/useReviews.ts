import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createReview, type CreateReviewBody } from "../api/reviews";

export function useCreateReview(productId: string, productSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReviewBody) => createReview(productId, body),
    onSuccess: () => {
      // The product detail query carries the review list and the average
      // rating, so refetching it is what makes the new review appear.
      queryClient.invalidateQueries({ queryKey: ["product", productSlug] });
    },
  });
}
