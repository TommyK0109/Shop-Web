import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-link hover:underline">
        Back to home
      </Link>
    </div>
  );
}
