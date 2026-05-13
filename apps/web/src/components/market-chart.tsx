"use client";

import { useEffect, useMemo, useRef } from "react";
import { createChart, ColorType, CandlestickSeries, HistogramSeries, type IChartApi } from "lightweight-charts";
import type { MarketHistoryPoint } from "@/lib/types";

type MarketChartProps = {
  data: MarketHistoryPoint[];
  height?: number;
  accentColor?: string;
  positiveColor?: string;
  negativeColor?: string;
};

export function MarketChart({
  data,
  height = 420,
  accentColor = "#a8e6ff",
  positiveColor = "#34d399",
  negativeColor = "#f87171",
}: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const chartData = useMemo(() => {
    return data.map((point) => ({
      time: {
        year: new Date(point.time * 1000).getFullYear(),
        month: new Date(point.time * 1000).getMonth() + 1,
        day: new Date(point.time * 1000).getDate(),
      },
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume,
      color: point.close >= point.open ? positiveColor : negativeColor,
    }));
  }, [data, positiveColor, negativeColor]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(226,231,239,0.72)",
        fontFamily: "var(--font-sans), Inter, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: accentColor, style: 2, labelBackgroundColor: accentColor },
        horzLine: { color: accentColor, style: 2, labelBackgroundColor: accentColor },
      },
      localization: {
        dateFormat: "MMM d",
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: positiveColor,
      downColor: negativeColor,
      borderUpColor: positiveColor,
      borderDownColor: negativeColor,
      wickUpColor: positiveColor,
      wickDownColor: negativeColor,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    
    chart.priceScale("").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;

    candleSeries.setData(chartData as any);
    volumeSeries.setData(
      chartData.map((point) => ({
        time: point.time,
        value: point.volume,
        color: `${point.color}66`,
      })) as any
    );

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current) return;
      chart.applyOptions({ width: containerRef.current.clientWidth });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [accentColor, chartData, height, negativeColor, positiveColor]);

  return <div ref={containerRef} className="h-full w-full" />;
}