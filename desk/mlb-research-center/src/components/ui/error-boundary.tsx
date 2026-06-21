'use client'

import { Component, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  name?: string
}

interface State {
  hasError: boolean
}

const ERROR_31_PATTERN = /Element type is invalid|got: object with keys/

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    const isError31 = ERROR_31_PATTERN.test(error.message)
    if (isError31) {
      console.error(
        `ErrorBoundary${this.props.name ? ` (${this.props.name})` : ''} — ERROR #31 DETECTED:`,
        error.message,
        '\nComponent Stack:',
        info?.componentStack || 'no stack'
      )
    } else {
      console.error(`ErrorBoundary${this.props.name ? ` (${this.props.name})` : ''}:`, error)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center p-6 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 text-red-400 mb-2" />
            <p>Something went wrong</p>
          </div>
        )
      )
    }
    return this.props.children
  }
}
