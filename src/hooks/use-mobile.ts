import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Always false on both the server render and the client's first render —
  // reading window.innerWidth in the initializer would make the client's
  // first render diverge from the server's (which has no window at all),
  // causing a hydration mismatch. The real value is applied in the effect
  // below, after hydration completes.
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
