import { logoutAction } from "../actions";

/**
 * Logout Page
 *
 * Displays a logout confirmation before executing logout.
 * This is a simple page that shows a logout button.
 */
export default function LogoutPage() {
  return (
    <div className="text-center">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Sign out</h2>

      <p className="text-gray-600 mb-6">Are you sure you want to sign out?</p>

      <form action={logoutAction}>
        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Sign out
        </button>
      </form>

      <div className="mt-4">
        <a
          href="/dashboard"
          className="text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          Cancel
        </a>
      </div>
    </div>
  );
}
