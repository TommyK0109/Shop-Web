import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { createReviewSchema } from "@storefront/shared";
import { useAuth } from "../hooks/useAuth";
import { useOrders } from "../hooks/useOrders";
import { useCreateReview } from "../hooks/useReviews";
import { StarRatingInput } from "./StarRatingInput";
import type { Review } from "../api/types";

interface ReviewFormProps {
  productId: string;
  productSlug: string;
  reviews: Review[];
}

export function ReviewForm({ productId, productSlug, reviews }: ReviewFormProps) {
  const { user, isAuthenticated } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const createReview = useCreateReview(productId, productSlug);

  // Eligibility is mirrored here purely so the UI can explain itself before
  // the user types anything — the server re-checks both rules on POST and is
  // the only thing that actually enforces them.
  const { data: ordersData, isLoading: ordersLoading } = useOrders({ enabled: isAuthenticated });
  const hasPurchased = Boolean(
    ordersData?.orders.some(
      (order) => order.status === "paid" && order.items.some((item) => item.productId === productId),
    ),
  );
  const alreadyReviewed = reviews.some((review) => review.user.id === user?.id);

  if (!isAuthenticated) {
    return (
      <p className="rounded bg-white p-4 text-sm text-gray-600">
        <Link to="/login" className="text-link hover:underline">
          Sign in
        </Link>{" "}
        to review a product you've bought.
      </p>
    );
  }

  if (alreadyReviewed) {
    return <p className="rounded bg-white p-4 text-sm text-gray-600">You've already reviewed this product.</p>;
  }

  if (ordersLoading) {
    return <p className="rounded bg-white p-4 text-sm text-gray-500">Checking your orders…</p>;
  }

  if (!hasPurchased) {
    return (
      <p className="rounded bg-white p-4 text-sm text-gray-600">
        Only verified buyers can review. Once an order containing this product is paid, you'll be able to
        leave a rating here.
      </p>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setValidationError(null);

    // Same Zod schema the server validates against — one definition, two
    // enforcement points.
    const parsed = createReviewSchema.safeParse({
      rating,
      comment: comment.trim() || undefined,
    });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Please check your review");
      return;
    }

    createReview.mutate(parsed.data, {
      onSuccess: () => {
        setRating(0);
        setComment("");
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Write a review</h3>

      <div className="mt-3">
        <StarRatingInput value={rating} onChange={setRating} disabled={createReview.isPending} />
      </div>

      <label htmlFor="review-comment" className="mt-4 block text-xs font-medium text-gray-700">
        Comment <span className="font-normal text-gray-400">(optional)</span>
      </label>
      <textarea
        id="review-comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="How did it work out for you?"
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-dark"
      />

      {(validationError || createReview.isError) && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {validationError ?? (createReview.error as Error).message}
        </p>
      )}

      <button
        type="submit"
        disabled={createReview.isPending}
        className="mt-3 rounded bg-accent px-5 py-2 text-sm font-medium text-ink hover:bg-accent-dark disabled:opacity-60"
      >
        {createReview.isPending ? "Posting…" : "Post review"}
      </button>
    </form>
  );
}
