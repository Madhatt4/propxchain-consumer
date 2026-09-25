import { useId } from 'react';

interface StarRatingProps {
  rating: number;
  reviews: number;
}

export function StarRating({ rating, reviews }: StarRatingProps): React.ReactElement | null {
  const uid = useId();

  // No reviews yet — empty stars + "0.0 (0)" reads as broken. Return a
  // small placeholder so the column doesn't go cold-empty either.
  if (reviews === 0) {
    return (
      <span className="font-dm-sans text-xs text-gray-400 dark:text-gray-500">
        No reviews yet
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = Math.min(1, Math.max(0, rating - (star - 1)));
          const clipId = `${uid}-star-${star}`;
          return (
            <svg
              key={star}
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="M10 1l2.39 4.84L17.3 6.7l-3.65 3.56.86 5.03L10 13.01l-4.51 2.28.86-5.03L2.7 6.7l4.91-.86L10 1z"
                className="fill-gray-300 dark:fill-gray-600"
              />
              {fill > 0 && (
                <>
                  <clipPath id={clipId}>
                    <rect x="0" y="0" width={fill * 20} height="20" />
                  </clipPath>
                  <path
                    d="M10 1l2.39 4.84L17.3 6.7l-3.65 3.56.86 5.03L10 13.01l-4.51 2.28.86-5.03L2.7 6.7l4.91-.86L10 1z"
                    fill="#D4A843"
                    clipPath={`url(#${clipId})`}
                  />
                </>
              )}
            </svg>
          );
        })}
      </div>
      <span className="font-geist-mono text-xs text-gray-500 dark:text-gray-400">
        {rating.toFixed(1)}
      </span>
      <span className="text-xs text-gray-400 dark:text-gray-500">
        ({reviews.toLocaleString()})
      </span>
    </div>
  );
}
