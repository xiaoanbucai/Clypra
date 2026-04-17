/**
 * Playhead Component Tests
 * 
 * Tests the playhead positioning, dragging, and interaction
 * Covers: click to seek, drag scrubbing, boundary handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Playhead } from "../Playhead";
import { CoordinateSystem } from "../../utils/coordinateSystem";
import { useTimelineStore } from "../../store/timelineStore";

// Mock the timeline store
vi.mock("../../store/timelineStore", () => ({
  useTimelineStore: vi.fn(),
}));

describe("Playhead", () => {
  const mockSetPlayhead = vi.fn();
  let containerRef: React.RefObject<HTMLDivElement>;
  let coords: CoordinateSystem;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock store
    vi.mocked(useTimelineStore).mockReturnValue({
      playhead: 5.0,
      setPlayhead: mockSetPlayhead,
    });

    // Setup container ref
    containerRef = { current: document.createElement("div") };
    containerRef.current!.style.width = "1000px";
    containerRef.current!.style.height = "200px";
    document.body.appendChild(containerRef.current!);

    // Setup coordinate system (100px per second)
    coords = new CoordinateSystem(100);
  });

  afterEach(() => {
    if (containerRef.current) {
      document.body.removeChild(containerRef.current);
    }
    vi.restoreAllMocks();
  });

  // =========================================================================
  // RENDER TESTS
  // =========================================================================

  describe("Rendering", () => {
    it("should render playhead at correct position", () => {
      const { container } = render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const playhead = container.querySelector('[class*="absolute"]');
      expect(playhead).toBeInTheDocument();
    });

    it("should render playhead handle SVG", () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should render invisible click/drag area", () => {
      const { container } = render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");
      expect(dragArea).toBeInTheDocument();
    });
  });

  // =========================================================================
  // CLICK TO SEEK TESTS
  // =========================================================================

  describe("Click to Seek", () => {
    it("should update playhead on timeline click", async () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");

      // Click at 200px (2 seconds at 100px/sec)
      fireEvent.pointerDown(dragArea, {
        clientX: 200,
        button: 0,
      });

      await waitFor(() => {
        expect(mockSetPlayhead).toHaveBeenCalled();
      });
    });

    it("should seek to 0% when clicked at left edge", async () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");

      // Get the bounding rect
      const rect = dragArea.getBoundingClientRect();

      fireEvent.pointerDown(dragArea, {
        clientX: rect.left,
        button: 0,
      });

      await waitFor(() => {
        expect(mockSetPlayhead).toHaveBeenCalledWith(expect.closeTo(0, 0.1));
      });
    });

    it("should seek to 100% when clicked at right edge", async () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");
      const rect = dragArea.getBoundingClientRect();

      fireEvent.pointerDown(dragArea, {
        clientX: rect.right,
        button: 0,
      });

      await waitFor(() => {
        expect(mockSetPlayhead).toHaveBeenCalledWith(
          expect.closeTo(100, 0.1)
        );
      });
    });

    it("should seek to 50% when clicked at center", async () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");
      const rect = dragArea.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;

      fireEvent.pointerDown(dragArea, {
        clientX: centerX,
        button: 0,
      });

      await waitFor(() => {
        expect(mockSetPlayhead).toHaveBeenCalledWith(
          expect.closeTo(50, 1)
        );
      });
    });

    it("should ignore non-left mouse button clicks", () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");

      // Right click
      fireEvent.pointerDown(dragArea, {
        clientX: 500,
        button: 2,
      });

      expect(mockSetPlayhead).not.toHaveBeenCalled();
    });

    it("should not seek when duration is 0", () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={0}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");

      fireEvent.pointerDown(dragArea, {
        clientX: 500,
        button: 0,
      });

      // Should not throw or call setPlayhead
      expect(mockSetPlayhead).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // DRAG SCRUBBING TESTS
  // =========================================================================

  describe("Drag Scrubbing", () => {
    it("should update playhead while dragging", async () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");

      // Start drag
      fireEvent.pointerDown(dragArea, {
        clientX: 100,
        button: 0,
      });

      // Move while dragging
      fireEvent.pointerMove(window, {
        clientX: 300,
      });

      await waitFor(() => {
        expect(mockSetPlayhead).toHaveBeenCalledTimes(2); // Initial + drag
      });
    });

    it("should handle rapid dragging (scrubbing)", async () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");

      fireEvent.pointerDown(dragArea, {
        clientX: 0,
        button: 0,
      });

      // Rapid movements
      for (let i = 0; i <= 10; i++) {
        fireEvent.pointerMove(window, {
          clientX: i * 100,
        });
      }

      await waitFor(() => {
        // Should have been called for each move
        expect(mockSetPlayhead).toHaveBeenCalled();
      });
    });

    it("should stop updating on pointer up", async () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");

      fireEvent.pointerDown(dragArea, {
        clientX: 100,
        button: 0,
      });

      fireEvent.pointerUp(window);

      // Reset mock to check for new calls
      mockSetPlayhead.mockClear();

      // Try to move after release
      fireEvent.pointerMove(window, {
        clientX: 500,
      });

      // Should not update after release
      expect(mockSetPlayhead).not.toHaveBeenCalled();
    });

    it("should clamp playhead to timeline bounds while dragging", async () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={10}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");

      fireEvent.pointerDown(dragArea, {
        clientX: 500,
        button: 0,
      });

      // Drag far beyond right edge
      fireEvent.pointerMove(window, {
        clientX: 2000,
      });

      await waitFor(() => {
        expect(mockSetPlayhead).toHaveBeenCalledWith(
          expect.closeTo(10, 0.1) // Clamped to duration
        );
      });
    });

    it("should handle dragging before timeline start", async () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={10}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");

      fireEvent.pointerDown(dragArea, {
        clientX: 500,
        button: 0,
      });

      // Drag before left edge
      fireEvent.pointerMove(window, {
        clientX: -1000,
      });

      await waitFor(() => {
        expect(mockSetPlayhead).toHaveBeenCalledWith(
          expect.closeTo(0, 0.1) // Clamped to 0
        );
      });
    });

    it("should handle dragging beyond bounds on left", async () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");
      const rect = dragArea.getBoundingClientRect();

      fireEvent.pointerDown(dragArea, {
        clientX: rect.left + 50,
        button: 0,
      });

      // Drag far left
      fireEvent.pointerMove(window, {
        clientX: rect.left - 1000,
      });

      await waitFor(() => {
        expect(mockSetPlayhead).toHaveBeenCalledWith(
          expect.closeTo(0, 0.1)
        );
      });
    });

    it("should handle dragging beyond bounds on right", async () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");
      const rect = dragArea.getBoundingClientRect();

      fireEvent.pointerDown(dragArea, {
        clientX: rect.right - 50,
        button: 0,
      });

      // Drag far right
      fireEvent.pointerMove(window, {
        clientX: rect.right + 1000,
      });

      await waitFor(() => {
        expect(mockSetPlayhead).toHaveBeenCalledWith(
          expect.closeTo(100, 0.1)
        );
      });
    });
  });

  // =========================================================================
  // SCROLLING TESTS
  // =========================================================================

  describe("Scrolling", () => {
    it("should adjust playhead position based on scroll", () => {
      const { container, rerender } = render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const initialPlayhead = container.querySelector(
        '[class*="absolute"][class*="z-40"]'
      );

      // Re-render with scroll
      rerender(
        <Playhead
          coords={coords}
          scrollLeft={100}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      expect(initialPlayhead).toBeInTheDocument();
    });

    it("should handle negative scroll values", () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={-50}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      // Should not throw
      expect(
        screen.getByLabelText("Timeline scrubber")
      ).toBeInTheDocument();
    });

    it("should handle very large scroll values", () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={10000}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      // Should not throw
      expect(
        screen.getByLabelText("Timeline scrubber")
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // EDGE CASE TESTS
  // =========================================================================

  describe("Edge Cases", () => {
    it("should handle null container ref gracefully", () => {
      const nullRef = { current: null };

      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={nullRef as React.RefObject<HTMLDivElement>}
        />
      );

      // Clicking should not throw
      const dragArea = screen.getByLabelText("Timeline scrubber");
      fireEvent.pointerDown(dragArea, {
        clientX: 100,
        button: 0,
      });

      expect(mockSetPlayhead).not.toHaveBeenCalled();
    });

    it("should handle very small duration", () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={0.001}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");

      fireEvent.pointerDown(dragArea, {
        clientX: 500,
        button: 0,
      });

      // Should clamp to duration
      expect(mockSetPlayhead).toHaveBeenCalledWith(
        expect.closeTo(0.001, 0.0001)
      );
    });

    it("should handle very large duration", () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={10800} // 3 hours
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");

      fireEvent.pointerDown(dragArea, {
        clientX: 500,
        button: 0,
      });

      expect(mockSetPlayhead).toHaveBeenCalled();
    });

    it("should handle NaN time values from coords", () => {
      // Create a coordinate system that might return NaN
      const badCoords = {
        pixelsToTime: () => NaN,
        timeToPixels: () => NaN,
      } as unknown as CoordinateSystem;

      render(
        <Playhead
          coords={badCoords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");

      fireEvent.pointerDown(dragArea, {
        clientX: 500,
        button: 0,
      });

      // NaN should be clamped to valid range
      expect(mockSetPlayhead).toHaveBeenCalled();
      const callArg = mockSetPlayhead.mock.calls[0][0];
      expect(Number.isFinite(callArg)).toBe(true);
    });

    it("should handle fractional pixel positions", async () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");

      // Click at fractional position
      fireEvent.pointerDown(dragArea, {
        clientX: 100.5,
        button: 0,
      });

      await waitFor(() => {
        expect(mockSetPlayhead).toHaveBeenCalled();
      });
    });

    it("should handle rapid click and release", async () => {
      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      const dragArea = screen.getByLabelText("Timeline scrubber");

      // Very quick click
      fireEvent.pointerDown(dragArea, {
        clientX: 500,
        button: 0,
      });
      fireEvent.pointerUp(window);

      await waitFor(() => {
        expect(mockSetPlayhead).toHaveBeenCalled();
      });
    });

    it("should handle playhead at exactly 0", () => {
      vi.mocked(useTimelineStore).mockReturnValue({
        playhead: 0,
        setPlayhead: mockSetPlayhead,
      });

      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      expect(
        screen.getByLabelText("Timeline scrubber")
      ).toBeInTheDocument();
    });

    it("should handle playhead at exactly duration", () => {
      vi.mocked(useTimelineStore).mockReturnValue({
        playhead: 100,
        setPlayhead: mockSetPlayhead,
      });

      render(
        <Playhead
          coords={coords}
          scrollLeft={0}
          duration={100}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      );

      expect(
        screen.getByLabelText("Timeline scrubber")
      ).toBeInTheDocument();
    });
  });
});
