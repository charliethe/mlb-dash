'use client'

export const dynamic = 'force-dynamic'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" className="dark">
      <body className="h-screen flex items-center justify-center bg-[#1a1a2e] text-[#e0e0e0] font-sans antialiased">
        <div className="text-center space-y-4 p-8">
          <h1 className="text-3xl font-bold text-red-400">Critical Error</h1>
          <p className="text-sm text-gray-400">MLB Research Center encountered an error.</p>
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  )
}
