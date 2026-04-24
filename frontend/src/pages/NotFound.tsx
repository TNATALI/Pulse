import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="mt-2 text-gray-600">Page not found</p>
      <Link to="/" className="mt-4 text-blue-600 hover:text-blue-800 text-sm">
        Back to Home
      </Link>
    </div>
  );
}
