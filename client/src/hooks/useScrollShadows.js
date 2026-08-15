import { useEffect, useState } from "react";

export default function useScrollShadows(ref) {
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);

  useEffect(() => {
    const element = ref?.current;

    if (!element) return;

    const updateShadows = () => {
      const { scrollTop, scrollHeight, clientHeight } = element;

      setShowTopShadow(scrollTop > 0);

      setShowBottomShadow(
        scrollTop + clientHeight < scrollHeight - 1
      );
    };

    updateShadows();

    element.addEventListener("scroll", updateShadows);

    const resizeObserver = new ResizeObserver(updateShadows);
    resizeObserver.observe(element);

    window.addEventListener("resize", updateShadows);

    return () => {
      element.removeEventListener("scroll", updateShadows);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateShadows);
    };
  }, [ref]);

  return {
    showTopShadow,
    showBottomShadow,
  };
}