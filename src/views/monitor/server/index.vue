<script setup lang="ts">
import dayjs from "dayjs";
import {
  computed,
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from "vue";
import { useDark, useECharts } from "@pureadmin/utils";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { baseUrlApi } from "@/api/utils";
import { getServerMonitor, type ServerMonitorResult } from "@/api/system";
import { getToken } from "@/utils/auth";
import echarts from "@/plugins/echarts";

import Refresh from "~icons/ep/refresh";
import Monitor from "~icons/ri/pulse-line";
import Cpu from "~icons/ri/cpu-line";
import HardDrive from "~icons/ri/hard-drive-2-line";
import Database from "~icons/ri/database-2-line";
import Global from "~icons/ri/global-line";
import Fullscreen from "~icons/ri/fullscreen-line";
import Download from "~icons/ri/download-line";

defineOptions({
  name: "ServerMonitor"
});

const { isDark } = useDark();
const loading = ref(false);
const monitor = ref<ServerMonitorResult | null>(null);
const streamStatus = ref<"connecting" | "connected" | "disconnected">(
  "connecting"
);
const reconnectTimer = ref<number | null>(null);
const connectTimeoutTimer = ref<number | null>(null);
const socketRef = ref<WebSocket | null>(null);
const streamRetryMs = ref(3000);
const reconnectAttempts = ref(0);
const defaultVisibleHistoryMs = 4 * 60 * 60 * 1000;
const maxClientHistoryMs = 24 * 60 * 60 * 1000;
let disposed = false;
let activeStreamSeq = 0;

const timeRangeOptions = [
  { label: "最近1小时", value: 1 * 60 * 60 * 1000 },
  { label: "最近4小时", value: 4 * 60 * 60 * 1000 },
  { label: "最近24小时", value: 24 * 60 * 60 * 1000 }
];

type ServerMonitorStreamData = {
  seq?: number;
  mode?: "init" | "append";
  sampleIntervalMs?: number;
  serverRetryMs?: number;
  snapshot?: ServerMonitorResult["snapshot"];
  history?: ServerMonitorResult["history"];
  appendSample?: ServerMonitorResult["history"][number];
};

type ServerMonitorStreamPayload = {
  code?: number;
  msg?: string;
  data?: ServerMonitorStreamData;
  meta?: {
    serverRetryMs?: number;
  };
};

type ServerMonitorWsMessage = {
  event?: string;
  data?: ServerMonitorStreamPayload;
};

const cpuTrendRef = ref();
const memoryTrendRef = ref();
const diskTrendRef = ref();
const loadTrendRef = ref();
const swapTrendRef = ref();
const goroutineTrendRef = ref();
const heapTrendRef = ref();
const coreChartRef = ref();
const networkChartRef = ref();
const previewChartRef = ref();

type ChartKey =
  | "cpuTrend"
  | "memoryTrend"
  | "diskTrend"
  | "loadTrend"
  | "swapTrend"
  | "goroutineTrend"
  | "heapTrend"
  | "coreChart"
  | "networkChart";

const chartTheme = computed(() => (isDark.value ? "dark" : "light"));
const { setOptions: setCpuTrendOptions } = useECharts(cpuTrendRef, {
  theme: chartTheme
});
const { setOptions: setMemoryTrendOptions } = useECharts(memoryTrendRef, {
  theme: chartTheme
});
const { setOptions: setDiskTrendOptions } = useECharts(diskTrendRef, {
  theme: chartTheme
});
const { setOptions: setLoadTrendOptions } = useECharts(loadTrendRef, {
  theme: chartTheme
});
const { setOptions: setSwapTrendOptions } = useECharts(swapTrendRef, {
  theme: chartTheme
});
const { setOptions: setGoroutineTrendOptions } = useECharts(goroutineTrendRef, {
  theme: chartTheme
});
const { setOptions: setHeapTrendOptions } = useECharts(heapTrendRef, {
  theme: chartTheme
});
const { setOptions: setCoreOptions } = useECharts(coreChartRef, {
  theme: chartTheme
});
const { setOptions: setNetworkOptions } = useECharts(networkChartRef, {
  theme: chartTheme
});

const chartOptions = ref<Partial<Record<ChartKey, Record<string, any>>>>({});
const previewVisible = ref(false);
const previewChartKey = ref<ChartKey | null>(null);
const previewChartTitle = ref("");
const previewPinnedTip = ref<{
  seriesIndex?: number;
  dataIndex?: number;
  sampleTimestamp?: string;
} | null>(null);
const previewZoomRange = ref<{
  startValue?: number;
  endValue?: number;
} | null>(null);
const selectedTimeRangeMs = ref<number>(defaultVisibleHistoryMs);
let previewChartInstance: any = null;
let previewRenderTimer: number | null = null;
let previewChartClickLock = false;

const snapshot = computed(() => monitor.value?.snapshot);
const host = computed(() => snapshot.value?.host);
const cpu = computed(() => snapshot.value?.cpu);
const memory = computed(() => snapshot.value?.memory);
const swap = computed(() => snapshot.value?.swap);
const disks = computed(() => snapshot.value?.disks ?? []);
const networks = computed(() => snapshot.value?.network ?? []);
const goRuntime = computed(() => snapshot.value?.goRuntime);
const history = computed(() => monitor.value?.history ?? []);
const recentHistory = computed(() => {
  if (!history.value.length) return [];
  const cutoff = getHistoryCutoff(history.value, selectedTimeRangeMs.value);
  const items = history.value.filter(
    item => toSampleTime(item.timestamp) >= cutoff
  );
  return items.length ? items : history.value;
});
const primaryDisk = computed(() => disks.value[0]);
const hostUsers = computed(() => host.value?.users ?? []);
const totalNetErrors = computed(() =>
  networks.value.reduce((total, item) => total + item.errin + item.errout, 0)
);
const totalNetDrops = computed(() =>
  networks.value.reduce((total, item) => total + item.dropin + item.dropout, 0)
);
const streamStatusText = computed(() => {
  switch (streamStatus.value) {
    case "connected":
      return "WebSocket 已连接";
    case "connecting":
      return "WebSocket 连接中";
    default:
      return "WebSocket 已断开";
  }
});
const streamStatusType = computed(() => {
  switch (streamStatus.value) {
    case "connected":
      return "success";
    case "connecting":
      return "warning";
    default:
      return "danger";
  }
});

function formatBytes(bytes?: number) {
  if (bytes == null) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 2)} ${units[index]}`;
}

function formatPercent(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

function formatNumber(value?: number) {
  return Number(value ?? 0).toFixed(2);
}

function formatInteger(value?: number) {
  return Number(value ?? 0).toLocaleString();
}

function formatDuration(seconds?: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds ?? 0));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0 || days > 0) parts.push(`${hours}小时`);
  parts.push(`${minutes}分钟`);
  return parts.join(" ");
}

function formatUserStarted(value?: number) {
  if (!value) return "-";
  const timestamp = value > 1e12 ? value : value * 1000;
  return dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss");
}

function toSampleTime(timestamp?: string) {
  const value = dayjs(timestamp).valueOf();
  return Number.isFinite(value) ? value : 0;
}

function getHistoryCutoff(
  samples: ServerMonitorResult["history"],
  durationMs: number
) {
  if (!samples.length) return 0;
  const latest = toSampleTime(samples[samples.length - 1]?.timestamp);
  return latest > 0 ? latest - durationMs : 0;
}

function trimHistorySamples(samples: ServerMonitorResult["history"]) {
  if (!samples.length) return [];
  const cutoff = getHistoryCutoff(samples, maxClientHistoryMs);
  const items = samples.filter(item => toSampleTime(item.timestamp) >= cutoff);
  return items.length ? items : samples;
}

function getDefaultPreviewZoomRange() {
  if (!history.value.length) return null;
  const cutoff = getHistoryCutoff(history.value, selectedTimeRangeMs.value);
  const startValue = history.value.findIndex(
    item => toSampleTime(item.timestamp) >= cutoff
  );
  return {
    startValue: startValue >= 0 ? startValue : 0,
    endValue: history.value.length - 1
  };
}

function updateChartOption(
  key: ChartKey,
  option: Record<string, any>,
  setter: (option: Record<string, any>) => void
) {
  chartOptions.value[key] = markRaw(option);
  setter(option);
}

async function openChartPreview(key: ChartKey, title: string) {
  previewChartKey.value = key;
  previewChartTitle.value = title;
  previewPinnedTip.value = null;
  previewZoomRange.value = getDefaultPreviewZoomRange();
  previewVisible.value = true;
  await nextTick();
  scheduleRenderPreviewChart(80);
}

function getPreviewChartOption() {
  const key = previewChartKey.value;
  if (!key) return null;
  const option = chartOptions.value[key];
  if (!option) return null;
  const isPinned = Boolean(previewPinnedTip.value);
  const useTimeNavigator = isHistoryChart(key);
  const baseGrid = (option.grid ?? {}) as Record<string, any>;
  const zoomRange = previewZoomRange.value ?? getDefaultPreviewZoomRange();
  return {
    ...option,
    grid: useTimeNavigator
      ? {
          ...baseGrid,
          bottom:
            typeof baseGrid.bottom === "number"
              ? Math.max(baseGrid.bottom, 90)
              : 90
        }
      : option.grid,
    tooltip: {
      ...(option.tooltip ?? {}),
      confine: true,
      position: previewTooltipPosition,
      triggerOn: isPinned ? "none" : "mousemove|click",
      alwaysShowContent: true
    },
    dataZoom: useTimeNavigator
      ? [
          {
            type: "inside",
            xAxisIndex: 0,
            filterMode: "filter",
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: true
          },
          {
            type: "slider",
            xAxisIndex: 0,
            height: 28,
            bottom: 24,
            borderColor: "transparent",
            backgroundColor: isDark.value
              ? "rgba(255,255,255,0.06)"
              : "rgba(15,23,42,0.06)",
            fillerColor: isDark.value
              ? "rgba(255,255,255,0.18)"
              : "rgba(59,130,246,0.18)",
            handleSize: 16,
            handleStyle: {
              color: isDark.value ? "#e5e7eb" : "#3b82f6",
              borderColor: isDark.value ? "#9ca3af" : "#2563eb"
            },
            moveHandleSize: 0,
            showDetail: true,
            brushSelect: false,
            startValue: zoomRange?.startValue,
            endValue: zoomRange?.endValue
          }
        ]
      : option.dataZoom
  };
}

function isHistoryChart(key?: ChartKey | null) {
  return (
    key === "cpuTrend" ||
    key === "memoryTrend" ||
    key === "diskTrend" ||
    key === "loadTrend" ||
    key === "swapTrend" ||
    key === "goroutineTrend" ||
    key === "heapTrend" ||
    key === "networkChart"
  );
}

function resolvePreviewPinnedTip() {
  const pinned = previewPinnedTip.value;
  const key = previewChartKey.value;
  if (!pinned || !key) return null;

  if (isHistoryChart(key) && pinned.sampleTimestamp != null) {
    const dataIndex = history.value.findIndex(
      item => item.timestamp === pinned.sampleTimestamp
    );
    if (dataIndex < 0) {
      previewPinnedTip.value = null;
      return null;
    }
    return {
      seriesIndex: pinned.seriesIndex,
      dataIndex
    };
  }

  return {
    seriesIndex: pinned.seriesIndex,
    dataIndex: pinned.dataIndex
  };
}

function getPinnedSample(dataIndex?: number) {
  if (dataIndex == null) return null;
  return history.value[dataIndex] ?? null;
}

function getExportTooltipLines(
  key: ChartKey,
  dataIndex: number,
  seriesIndex = 0
): string[] {
  const sample = getPinnedSample(dataIndex);
  if (!sample) return [];

  const timeLabel = dayjs(sample.timestamp).format("YYYY-MM-DD HH:mm:ss");

  const formatSeriesLine = (label: string, value: string) =>
    `${label}: ${value}`;

  switch (key) {
    case "cpuTrend":
      return [
        timeLabel,
        formatSeriesLine("CPU", formatPercent(sample.cpuUsage))
      ];
    case "memoryTrend":
      return [
        timeLabel,
        formatSeriesLine("Memory", formatPercent(sample.memoryUsedPercent))
      ];
    case "diskTrend":
      return [
        timeLabel,
        formatSeriesLine("Disk", formatPercent(sample.diskUsedPercent))
      ];
    case "loadTrend":
      return [timeLabel, formatSeriesLine("Load", formatNumber(sample.load1))];
    case "swapTrend":
      return [
        timeLabel,
        formatSeriesLine("Swap", formatPercent(sample.swapUsedPercent))
      ];
    case "goroutineTrend":
      return [
        timeLabel,
        formatSeriesLine("Goroutines", formatInteger(sample.goroutines))
      ];
    case "heapTrend":
      return [
        timeLabel,
        formatSeriesLine("Heap", formatBytes(sample.heapAlloc))
      ];
    case "networkChart":
      return [
        timeLabel,
        formatSeriesLine("Sent", formatBytes(sample.netBytesSent)),
        formatSeriesLine("Recv", formatBytes(sample.netBytesRecv))
      ];
    case "coreChart": {
      const coreValue = cpu.value?.coreUsages?.[dataIndex];
      return [
        "CPU Core 分布",
        formatSeriesLine(
          `Core ${dataIndex + 1}`,
          coreValue != null ? formatPercent(coreValue) : "-"
        )
      ];
    }
    default:
      return [];
  }
}

function buildExportTooltipGraphic(
  key: ChartKey,
  dataIndex: number,
  chartWidth: number,
  chartHeight: number,
  _point: number[] | null,
  seriesIndex = 0
) {
  const lines = getExportTooltipLines(key, dataIndex, seriesIndex);
  if (!lines.length) return null;

  const paddingX = 14;
  const paddingY = 10;
  const lineHeight = 20;
  const width = Math.min(
    320,
    Math.max(
      180,
      lines.reduce((max, line) => Math.max(max, line.length * 9), 0) +
        paddingX * 2
    )
  );
  const height = paddingY * 2 + lineHeight * lines.length;
  const x = Math.max(16, (chartWidth - width) / 2);
  const y = Math.max(16, Math.min(40, (chartHeight - height) / 2));

  return {
    type: "group",
    left: x,
    top: y,
    silent: true,
    children: [
      {
        type: "rect",
        shape: {
          width,
          height,
          r: 8
        },
        style: {
          fill: isDark.value
            ? "rgba(28, 28, 28, 0.94)"
            : "rgba(255, 255, 255, 0.96)",
          stroke: isDark.value
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(15, 23, 42, 0.08)",
          shadowBlur: 18,
          shadowColor: isDark.value
            ? "rgba(0, 0, 0, 0.35)"
            : "rgba(15, 23, 42, 0.12)"
        }
      },
      ...lines.map((line, index) => ({
        type: "text",
        left: paddingX,
        top: paddingY + index * lineHeight,
        style: {
          text: line,
          fill:
            index === 0
              ? isDark.value
                ? "#f5f5f5"
                : "#111827"
              : isDark.value
                ? "#d4d4d8"
                : "#374151",
          font: `${index === 0 ? "600" : "400"} 13px sans-serif`,
          textVerticalAlign: "top"
        }
      }))
    ]
  };
}

function previewTooltipPosition(
  point: any,
  _params: any,
  _dom: any,
  _rect: any,
  size: any
) {
  const currentPoint = Array.isArray(point) ? point : null;
  if (!currentPoint) return null;

  const [pointX = 0, pointY = 0] = currentPoint;
  const [contentWidth = 0, contentHeight = 0] = size?.contentSize ?? [];
  const [viewWidth = 0, viewHeight = 0] = size?.viewSize ?? [];
  const gap = 12;

  let left = pointX + gap;
  if (left + contentWidth > viewWidth - gap) {
    left = pointX - contentWidth - gap;
  }
  left = Math.min(
    Math.max(gap, left),
    Math.max(gap, viewWidth - contentWidth - gap)
  );

  let top = pointY - contentHeight - gap;
  if (top < gap) {
    top = pointY + gap;
  }
  top = Math.min(
    Math.max(gap, top),
    Math.max(gap, viewHeight - contentHeight - gap)
  );

  return [left, top];
}

function disposePreviewChart() {
  if (previewRenderTimer) {
    window.clearTimeout(previewRenderTimer);
    previewRenderTimer = null;
  }
  if (!previewChartInstance) return;
  previewChartInstance.dispose();
  previewChartInstance = null;
}

function ensurePreviewChartInstance() {
  const chartDom = previewChartRef.value;
  if (!chartDom) return null;
  if (
    previewChartInstance &&
    previewChartInstance.getDom &&
    previewChartInstance.getDom() === chartDom
  ) {
    return previewChartInstance;
  }
  disposePreviewChart();
  previewChartInstance = echarts.init(chartDom, chartTheme.value);
  bindPreviewChartEvents(previewChartInstance);
  return previewChartInstance;
}

function renderPreviewChart() {
  const option = getPreviewChartOption();
  const instance = ensurePreviewChartInstance();
  if (!instance || !option) return;
  instance.clear();
  instance.setOption(option, true);
  const resolvedPinnedTip = resolvePreviewPinnedTip();
  if (resolvedPinnedTip) {
    instance.dispatchAction({
      type: "showTip",
      seriesIndex: resolvedPinnedTip.seriesIndex,
      dataIndex: resolvedPinnedTip.dataIndex
    });
  }
  nextTick(() => {
    previewChartInstance?.resize();
  });
}

function bindPreviewChartEvents(instance: any) {
  instance.on("click", (params: Record<string, any>) => {
    if (
      params?.componentType !== "series" ||
      params?.seriesIndex == null ||
      params?.dataIndex == null
    ) {
      return;
    }
    previewChartClickLock = true;
    previewPinnedTip.value = {
      seriesIndex: params.seriesIndex,
      dataIndex: params.dataIndex,
      sampleTimestamp: isHistoryChart(previewChartKey.value)
        ? history.value[params.dataIndex]?.timestamp
        : undefined
    };
    renderPreviewChart();
  });

  instance.getZr().on("click", (event: Record<string, any>) => {
    if (previewChartClickLock) {
      previewChartClickLock = false;
      return;
    }
    if (event?.target) return;
    clearPreviewPinnedTip();
  });

  instance.on("datazoom", () => {
    const option = instance.getOption?.();
    const zoom = Array.isArray(option?.dataZoom) ? option.dataZoom[0] : null;
    if (!zoom) return;
    previewZoomRange.value = {
      startValue:
        typeof zoom.startValue === "number" ? zoom.startValue : undefined,
      endValue: typeof zoom.endValue === "number" ? zoom.endValue : undefined
    };
  });
}

function clearPreviewPinnedTip() {
  if (!previewPinnedTip.value) return;
  previewPinnedTip.value = null;
  renderPreviewChart();
}

function exportPreviewChart() {
  if (
    !previewChartInstance ||
    !previewChartTitle.value ||
    !previewChartKey.value
  )
    return;

  const exportContainer = document.createElement("div");
  const width = previewChartInstance.getWidth();
  const height = previewChartInstance.getHeight();
  exportContainer.style.cssText = `position:fixed;left:-99999px;top:-99999px;width:${width}px;height:${height}px;pointer-events:none;`;
  document.body.appendChild(exportContainer);

  const exportChart = echarts.init(exportContainer, chartTheme.value);
  const baseOption = (getPreviewChartOption() ?? {}) as Record<string, any>;
  const resolvedPinnedTip = resolvePreviewPinnedTip();

  exportChart.setOption(
    {
      ...baseOption,
      animation: false
    },
    true
  );

  const rawTooltipPoint = resolvedPinnedTip
    ? exportChart.convertToPixel(
        { seriesIndex: resolvedPinnedTip.seriesIndex ?? 0 },
        resolvedPinnedTip.dataIndex
      )
    : null;
  const tooltipPoint = Array.isArray(rawTooltipPoint) ? rawTooltipPoint : null;
  const graphic = resolvedPinnedTip
    ? buildExportTooltipGraphic(
        previewChartKey.value,
        resolvedPinnedTip.dataIndex,
        width,
        height,
        tooltipPoint,
        resolvedPinnedTip.seriesIndex
      )
    : null;

  if (graphic) {
    exportChart.setOption(
      {
        graphic: [...((baseOption.graphic as any[]) ?? []), graphic]
      },
      false
    );
  }

  if (resolvedPinnedTip) {
    exportChart.dispatchAction({
      type: "showTip",
      seriesIndex: resolvedPinnedTip.seriesIndex,
      dataIndex: resolvedPinnedTip.dataIndex
    });
  }

  const dataUrl = exportChart.getDataURL({
    type: "png",
    pixelRatio: Math.max(window.devicePixelRatio || 1, 2),
    backgroundColor: isDark.value ? "#141414" : "#ffffff"
  });

  exportChart.dispose();
  document.body.removeChild(exportContainer);

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${previewChartTitle.value}-${dayjs().format("YYYYMMDD-HHmmss")}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function scheduleRenderPreviewChart(delay = 0) {
  if (previewRenderTimer) {
    window.clearTimeout(previewRenderTimer);
  }
  previewRenderTimer = window.setTimeout(() => {
    previewRenderTimer = null;
    nextTick(() => {
      window.requestAnimationFrame(() => {
        renderPreviewChart();
      });
    });
  }, delay);
}

function handlePreviewOpened() {
  scheduleRenderPreviewChart(30);
}

function handlePreviewClosed() {
  previewChartClickLock = false;
  previewPinnedTip.value = null;
  previewZoomRange.value = null;
  disposePreviewChart();
}

function handleTimeRangeChange(value: number) {
  selectedTimeRangeMs.value = value;
  previewZoomRange.value = getDefaultPreviewZoomRange();
  nextTick(() => {
    renderCharts();
  });
}

function resizePreviewChart() {
  previewChartInstance?.resize();
}

function baseLineTrendOption(
  title: string,
  color: string,
  values: number[],
  valueFormatter: (value: number) => string,
  yAxisFormatter: (value: number) => string
) {
  const labels = recentHistory.value.map(item =>
    dayjs(item.timestamp).format("HH:mm:ss")
  );
  return {
    animation: false,
    color: [color],
    tooltip: {
      trigger: "axis" as const,
      valueFormatter
    },
    grid: { left: 55, right: 20, top: 36, bottom: 30 },
    xAxis: { type: "category" as const, data: labels },
    yAxis: {
      type: "value" as const,
      name: title,
      axisLabel: {
        formatter: yAxisFormatter
      }
    },
    series: [
      {
        name: title,
        type: "line" as const,
        smooth: true,
        showSymbol: false,
        areaStyle: { opacity: 0.08 },
        lineStyle: { width: 3 },
        data: values
      }
    ]
  };
}

function updateMonitor(data?: ServerMonitorResult | null) {
  if (!data) return;
  monitor.value = data;
  nextTick(() => {
    renderCharts();
  });
}

async function fetchMonitor() {
  loading.value = true;
  try {
    const res = await getServerMonitor();
    if ((res?.code === 200 || res?.code === 0) && res.data) {
      updateMonitor(res.data);
    }
  } finally {
    loading.value = false;
  }
}

function basePercentTrendOption(
  title: string,
  color: string,
  values: number[]
) {
  const labels = recentHistory.value.map(item =>
    dayjs(item.timestamp).format("HH:mm:ss")
  );
  return {
    animation: false,
    color: [color],
    tooltip: {
      trigger: "axis" as const,
      valueFormatter: (value: number) => `${Number(value ?? 0).toFixed(2)}%`
    },
    grid: { left: 48, right: 20, top: 36, bottom: 30 },
    xAxis: { type: "category" as const, data: labels },
    yAxis: {
      type: "value" as const,
      min: 0,
      max: 100,
      name: title,
      axisLabel: {
        formatter: (value: number) => `${value.toFixed(2)}%`
      }
    },
    series: [
      {
        name: title,
        type: "line" as const,
        smooth: true,
        showSymbol: false,
        areaStyle: { opacity: 0.1 },
        lineStyle: { width: 3 },
        data: values.map(item => Number(item.toFixed(2)))
      }
    ]
  };
}

function renderCharts() {
  const visibleHistory = recentHistory.value;

  updateChartOption(
    "cpuTrend",
    basePercentTrendOption(
      "CPU",
      "#ef4444",
      visibleHistory.map(item => item.cpuUsage)
    ),
    setCpuTrendOptions
  );

  updateChartOption(
    "memoryTrend",
    basePercentTrendOption(
      "Memory",
      "#2563eb",
      visibleHistory.map(item => item.memoryUsedPercent)
    ),
    setMemoryTrendOptions
  );

  updateChartOption(
    "diskTrend",
    basePercentTrendOption(
      "Disk",
      "#f59e0b",
      visibleHistory.map(item => item.diskUsedPercent)
    ),
    setDiskTrendOptions
  );

  const labels = visibleHistory.map(item =>
    dayjs(item.timestamp).format("HH:mm:ss")
  );

  updateChartOption(
    "loadTrend",
    {
      animation: false,
      color: ["#10b981"],
      tooltip: {
        trigger: "axis" as const,
        valueFormatter: (value: number) => Number(value ?? 0).toFixed(2)
      },
      grid: { left: 48, right: 20, top: 36, bottom: 30 },
      xAxis: { type: "category" as const, data: labels },
      yAxis: {
        type: "value" as const,
        name: "Load",
        axisLabel: {
          formatter: (value: number) => value.toFixed(2)
        }
      },
      series: [
        {
          name: "Load",
          type: "line" as const,
          smooth: true,
          showSymbol: false,
          areaStyle: { opacity: 0.08 },
          lineStyle: { width: 3 },
          data: visibleHistory.map(item => Number(item.load1.toFixed(2)))
        }
      ]
    },
    setLoadTrendOptions
  );

  updateChartOption(
    "swapTrend",
    basePercentTrendOption(
      "Swap",
      "#f97316",
      visibleHistory.map(item => item.swapUsedPercent)
    ),
    setSwapTrendOptions
  );

  updateChartOption(
    "goroutineTrend",
    baseLineTrendOption(
      "Goroutines",
      "#14b8a6",
      visibleHistory.map(item => item.goroutines),
      value => formatInteger(Number(value ?? 0)),
      value => formatInteger(Number(value ?? 0))
    ),
    setGoroutineTrendOptions
  );

  updateChartOption(
    "heapTrend",
    baseLineTrendOption(
      "Heap",
      "#6366f1",
      visibleHistory.map(item => item.heapAlloc),
      value => formatBytes(Number(value ?? 0)),
      value => formatBytes(Number(value ?? 0))
    ),
    setHeapTrendOptions
  );

  updateChartOption(
    "coreChart",
    {
      animation: false,
      tooltip: {
        trigger: "axis" as const,
        valueFormatter: (value: number) => `${Number(value ?? 0).toFixed(2)}%`
      },
      grid: { left: 48, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: "category" as const,
        data: (cpu.value?.coreUsages ?? []).map(
          (_, index) => `Core ${index + 1}`
        )
      },
      yAxis: {
        type: "value" as const,
        min: 0,
        max: 100,
        name: "%",
        axisLabel: {
          formatter: (value: number) => `${value.toFixed(2)}%`
        }
      },
      series: [
        {
          type: "bar" as const,
          data: (cpu.value?.coreUsages ?? []).map(item =>
            Number(item.toFixed(2))
          ),
          itemStyle: { borderRadius: [6, 6, 0, 0] },
          label: {
            show: true,
            position: "top",
            formatter: ({ value }) => `${Number(value ?? 0).toFixed(2)}%`
          }
        }
      ]
    },
    setCoreOptions
  );

  updateChartOption(
    "networkChart",
    {
      animation: false,
      color: ["#8b5cf6", "#06b6d4"],
      tooltip: {
        trigger: "axis" as const,
        valueFormatter: (value: number) => formatBytes(Number(value ?? 0))
      },
      legend: { data: ["Sent", "Recv"] },
      grid: { left: 55, right: 20, top: 40, bottom: 30 },
      xAxis: { type: "category" as const, data: labels },
      yAxis: {
        type: "value" as const,
        axisLabel: {
          formatter: (value: number) => formatBytes(value)
        }
      },
      series: [
        {
          name: "Sent",
          type: "line" as const,
          smooth: true,
          showSymbol: false,
          data: visibleHistory.map(item => item.netBytesSent)
        },
        {
          name: "Recv",
          type: "line" as const,
          smooth: true,
          showSymbol: false,
          data: visibleHistory.map(item => item.netBytesRecv)
        }
      ]
    },
    setNetworkOptions
  );

  if (previewVisible.value && previewChartKey.value) {
    nextTick(() => {
      scheduleRenderPreviewChart();
    });
  }
}

function stopMonitorStream() {
  if (connectTimeoutTimer.value) {
    window.clearTimeout(connectTimeoutTimer.value);
    connectTimeoutTimer.value = null;
  }
  if (reconnectTimer.value) {
    window.clearTimeout(reconnectTimer.value);
    reconnectTimer.value = null;
  }
  if (socketRef.value) {
    const currentSocket = socketRef.value;
    socketRef.value = null;
    currentSocket.onopen = null;
    currentSocket.onmessage = null;
    currentSocket.onerror = null;
    currentSocket.onclose = null;
    if (
      currentSocket.readyState === WebSocket.OPEN ||
      currentSocket.readyState === WebSocket.CONNECTING
    ) {
      currentSocket.close();
    }
  }
}

function scheduleReconnect() {
  if (disposed || reconnectTimer.value) return;
  const delay = Math.min(
    streamRetryMs.value * 2 ** reconnectAttempts.value,
    30000
  );
  reconnectTimer.value = window.setTimeout(() => {
    reconnectTimer.value = null;
    reconnectAttempts.value += 1;
    startMonitorStream();
  }, delay);
}

function mergeAppendSample(sample?: ServerMonitorResult["history"][number]) {
  if (!sample) return;

  const current = monitor.value;
  if (!current) {
    monitor.value = {
      snapshot: {
        ...(snapshot.value ?? ({} as ServerMonitorResult["snapshot"])),
        current: sample,
        timestamp: sample.timestamp
      },
      history: [sample]
    };
    return;
  }

  const nextHistory = [...(current.history ?? [])];
  const lastSample = nextHistory[nextHistory.length - 1];
  if (lastSample?.timestamp === sample.timestamp) {
    nextHistory[nextHistory.length - 1] = sample;
  } else {
    nextHistory.push(sample);
  }

  monitor.value = {
    ...current,
    snapshot: current.snapshot
      ? {
          ...current.snapshot,
          current: sample,
          timestamp: sample.timestamp
        }
      : current.snapshot,
    history: trimHistorySamples(nextHistory)
  };
}

function applyStreamPayload(
  eventName: string,
  payload: ServerMonitorStreamPayload
) {
  const retryMs = payload?.data?.serverRetryMs ?? payload?.meta?.serverRetryMs;
  if (typeof retryMs === "number" && retryMs > 0) {
    streamRetryMs.value = retryMs;
  }

  if (eventName === "server_monitor_init" && payload?.data?.snapshot) {
    updateMonitor({
      snapshot: payload.data.snapshot,
      history: payload.data.history ?? []
    });
    return;
  }

  if (eventName === "server_monitor_append") {
    if (payload?.data?.snapshot) {
      monitor.value = {
        snapshot: payload.data.snapshot,
        history: monitor.value?.history ?? []
      };
    }
    mergeAppendSample(payload?.data?.appendSample);
    nextTick(() => {
      renderCharts();
    });
    return;
  }

  if (eventName === "error") {
    streamStatus.value = "disconnected";
    scheduleReconnect();
  }
}

function buildWebSocketUrl(token: string) {
  const endpoint = baseUrlApi("sys/server-monitor/ws");
  const url = new URL(endpoint, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  return url.toString();
}

function startMonitorStream() {
  stopMonitorStream();
  streamStatus.value = "connecting";
  if (!window.navigator.onLine) {
    streamStatus.value = "disconnected";
    scheduleReconnect();
    return;
  }
  const token = getToken()?.accessToken;
  if (!token) {
    streamStatus.value = "disconnected";
    return;
  }

  const streamSeq = ++activeStreamSeq;
  const socket = new WebSocket(buildWebSocketUrl(token));
  socketRef.value = socket;
  connectTimeoutTimer.value = window.setTimeout(() => {
    if (
      socketRef.value !== socket ||
      disposed ||
      streamSeq !== activeStreamSeq ||
      socket.readyState === WebSocket.OPEN
    ) {
      return;
    }
    streamStatus.value = "disconnected";
    socket.close();
  }, 10000);

  socket.onopen = () => {
    if (
      socketRef.value !== socket ||
      disposed ||
      streamSeq !== activeStreamSeq
    ) {
      socket.close();
      return;
    }
    if (connectTimeoutTimer.value) {
      window.clearTimeout(connectTimeoutTimer.value);
      connectTimeoutTimer.value = null;
    }
    reconnectAttempts.value = 0;
    streamStatus.value = "connected";
  };

  socket.onmessage = event => {
    if (
      socketRef.value !== socket ||
      disposed ||
      streamSeq !== activeStreamSeq
    ) {
      return;
    }
    handleWebSocketMessage(event.data);
  };

  socket.onerror = () => {
    if (
      socketRef.value !== socket ||
      disposed ||
      streamSeq !== activeStreamSeq
    ) {
      return;
    }
    if (connectTimeoutTimer.value) {
      window.clearTimeout(connectTimeoutTimer.value);
      connectTimeoutTimer.value = null;
    }
    streamStatus.value = "disconnected";
    socket.close();
  };

  socket.onclose = () => {
    if (connectTimeoutTimer.value) {
      window.clearTimeout(connectTimeoutTimer.value);
      connectTimeoutTimer.value = null;
    }
    if (socketRef.value === socket) {
      socketRef.value = null;
    }
    if (!disposed && streamSeq === activeStreamSeq) {
      streamStatus.value = "disconnected";
      scheduleReconnect();
    }
  };
}

function tryReconnectNow() {
  if (disposed) return;
  if (socketRef.value?.readyState === WebSocket.OPEN) return;
  reconnectAttempts.value = 0;
  startMonitorStream();
}

function handleWindowOnline() {
  tryReconnectNow();
}

function handleVisibilityChange() {
  if (document.visibilityState !== "visible") return;
  if (streamStatus.value === "connected") return;
  tryReconnectNow();
}

function handleWebSocketMessage(raw: string) {
  const message = JSON.parse(raw) as ServerMonitorWsMessage;
  if (!message?.event || !message.data) return;
  applyStreamPayload(message.event, message.data);
}

async function manualRefresh() {
  await fetchMonitor();
  if (streamStatus.value !== "connected") {
    tryReconnectNow();
  }
}

onMounted(async () => {
  await fetchMonitor();
  startMonitorStream();
  window.addEventListener("resize", resizePreviewChart);
  window.addEventListener("online", handleWindowOnline);
  document.addEventListener("visibilitychange", handleVisibilityChange);
});

watch(chartTheme, () => {
  if (!previewVisible.value || !previewChartKey.value) return;
  nextTick(() => {
    scheduleRenderPreviewChart();
  });
});

onBeforeUnmount(() => {
  disposed = true;
  stopMonitorStream();
  disposePreviewChart();
  window.removeEventListener("resize", resizePreviewChart);
  window.removeEventListener("online", handleWindowOnline);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});
</script>

<template>
  <div class="server-monitor-page">
    <div class="mb-4 flex items-center justify-between gap-3 monitor-header">
      <div>
        <div class="header-title-row">
          <h3 class="text-lg font-semibold">服务器监控</h3>
          <el-tag :type="streamStatusType" effect="plain" round>
            {{ streamStatusText }}
          </el-tag>
        </div>
        <p class="text-sm text-[var(--el-text-color-secondary)]">
          最近更新时间：{{
            snapshot?.timestamp
              ? dayjs(snapshot.timestamp).format("YYYY-MM-DD HH:mm:ss")
              : "-"
          }}
        </p>
      </div>
      <el-button
        type="primary"
        :icon="useRenderIcon(Refresh)"
        :loading="loading"
        @click="manualRefresh"
      >
        刷新
      </el-button>
    </div>

    <div class="mb-4 monitor-toolbar">
      <el-segmented
        :model-value="selectedTimeRangeMs"
        :options="timeRangeOptions"
        @change="handleTimeRangeChange"
      />
    </div>

    <div class="grid-cards mb-4">
      <el-card shadow="never">
        <template #header>
          <div class="card-title">
            <component :is="useRenderIcon(Cpu)" /> CPU
          </div>
        </template>
        <div class="metric">{{ formatPercent(cpu?.usage) }}</div>
        <div class="sub">{{ cpu?.modelName || "-" }}</div>
        <div class="sub">
          {{ cpu?.cores || 0 }} Core / {{ formatNumber(cpu?.mhz) }} MHz
        </div>
      </el-card>
      <el-card shadow="never">
        <template #header>
          <div class="card-title">
            <component :is="useRenderIcon(Database)" /> Memory
          </div>
        </template>
        <div class="metric">{{ formatPercent(memory?.usedPercent) }}</div>
        <div class="sub">Used {{ formatBytes(memory?.used) }}</div>
        <div class="sub">Available {{ formatBytes(memory?.available) }}</div>
      </el-card>
      <el-card shadow="never">
        <template #header>
          <div class="card-title">
            <component :is="useRenderIcon(HardDrive)" /> Disk
          </div>
        </template>
        <div class="metric">{{ formatPercent(primaryDisk?.usedPercent) }}</div>
        <div class="sub">Used {{ formatBytes(primaryDisk?.used) }}</div>
        <div class="sub">Free {{ formatBytes(primaryDisk?.free) }}</div>
      </el-card>
      <el-card shadow="never">
        <template #header>
          <div class="card-title">
            <component :is="useRenderIcon(Database)" /> Swap
          </div>
        </template>
        <div class="metric">{{ formatPercent(swap?.usedPercent) }}</div>
        <div class="sub">Used {{ formatBytes(swap?.used) }}</div>
        <div class="sub">Free {{ formatBytes(swap?.free) }}</div>
      </el-card>
      <el-card shadow="never">
        <template #header>
          <div class="card-title">
            <component :is="useRenderIcon(Monitor)" /> Runtime
          </div>
        </template>
        <div class="metric">{{ goRuntime?.goroutines || 0 }}</div>
        <div class="sub">Goroutines</div>
        <div class="sub">Heap {{ formatBytes(goRuntime?.heapAlloc) }}</div>
      </el-card>
      <el-card shadow="never">
        <template #header>
          <div class="card-title">
            <component :is="useRenderIcon(Global)" /> Host
          </div>
        </template>
        <div class="metric">{{ formatDuration(host?.uptime) }}</div>
        <div class="sub">Uptime</div>
        <div class="sub">
          Users {{ hostUsers.length }} / Proc {{ host?.processCount || 0 }}
        </div>
      </el-card>
    </div>

    <div class="grid gap-4 xl:grid-cols-2 mb-4">
      <el-card shadow="never">
        <template #header><span>主机信息</span></template>
        <div class="info-grid">
          <div>
            <span>主机名</span>
            <strong>{{ host?.hostname || "-" }}</strong>
          </div>
          <div>
            <span>系统</span>
            <strong>{{ host?.platform || host?.os || "-" }}</strong>
          </div>
          <div>
            <span>内核</span>
            <strong>{{ host?.kernelArch || "-" }}</strong>
          </div>
          <div>
            <span>启动时间</span>
            <strong>{{ host?.bootTime || "-" }}</strong>
          </div>
          <div>
            <span>运行时长</span>
            <strong>{{ formatDuration(host?.uptime) }}</strong>
          </div>
          <div>
            <span>进程数</span>
            <strong>{{ host?.processCount || 0 }}</strong>
          </div>
          <div>
            <span>登录终端数</span>
            <strong>{{ hostUsers.length }}</strong>
          </div>
          <div>
            <span>Load</span>
            <strong>
              {{ formatNumber(cpu?.load1) }} / {{ formatNumber(cpu?.load5) }} /
              {{ formatNumber(cpu?.load15) }}
            </strong>
          </div>
        </div>
      </el-card>
      <el-card shadow="never">
        <template #header><span>内存与交换分区</span></template>
        <div class="space-y-4">
          <div>
            <div class="progress-label">
              <span>内存</span>
              <span
                >{{ formatBytes(memory?.used) }} /
                {{ formatBytes(memory?.total) }}</span
              >
            </div>
            <el-progress
              :percentage="Number((memory?.usedPercent || 0).toFixed(2))"
            />
          </div>
          <div>
            <div class="progress-label">
              <span>交换分区</span>
              <span
                >{{ formatBytes(swap?.used) }} /
                {{ formatBytes(swap?.total) }}</span
              >
            </div>
            <el-progress
              :percentage="Number((swap?.usedPercent || 0).toFixed(2))"
              status="warning"
            />
          </div>
        </div>
      </el-card>
    </div>

    <div class="grid gap-4 xl:grid-cols-2 mb-4">
      <el-card shadow="never">
        <template #header><span>内存细分</span></template>
        <div class="info-grid">
          <div>
            <span>总内存</span>
            <strong>{{ formatBytes(memory?.total) }}</strong>
          </div>
          <div>
            <span>已使用</span>
            <strong>{{ formatBytes(memory?.used) }}</strong>
          </div>
          <div>
            <span>空闲</span>
            <strong>{{ formatBytes(memory?.free) }}</strong>
          </div>
          <div>
            <span>可用</span>
            <strong>{{ formatBytes(memory?.available) }}</strong>
          </div>
          <div>
            <span>缓存</span>
            <strong>{{ formatBytes(memory?.cached) }}</strong>
          </div>
          <div>
            <span>缓冲区</span>
            <strong>{{ formatBytes(memory?.buffers) }}</strong>
          </div>
        </div>
      </el-card>
      <el-card shadow="never">
        <template #header><span>Go Runtime 详情</span></template>
        <div class="info-grid">
          <div>
            <span>Goroutines</span>
            <strong>{{ formatInteger(goRuntime?.goroutines) }}</strong>
          </div>
          <div>
            <span>Heap Alloc</span>
            <strong>{{ formatBytes(goRuntime?.heapAlloc) }}</strong>
          </div>
          <div>
            <span>Heap Sys</span>
            <strong>{{ formatBytes(goRuntime?.heapSys) }}</strong>
          </div>
          <div>
            <span>Heap Idle</span>
            <strong>{{ formatBytes(goRuntime?.heapIdle) }}</strong>
          </div>
          <div>
            <span>Heap Inuse</span>
            <strong>{{ formatBytes(goRuntime?.heapInuse) }}</strong>
          </div>
          <div>
            <span>Stack Inuse</span>
            <strong>{{ formatBytes(goRuntime?.stackInuse) }}</strong>
          </div>
          <div>
            <span>GC 次数</span>
            <strong>{{ formatInteger(goRuntime?.numGC) }}</strong>
          </div>
        </div>
      </el-card>
    </div>

    <div class="trend-grid mb-4">
      <el-card shadow="never">
        <template #header>
          <div class="chart-card-header">
            <span>CPU 趋势</span>
            <el-button
              text
              size="small"
              :icon="useRenderIcon(Fullscreen)"
              @click="openChartPreview('cpuTrend', 'CPU 趋势')"
            >
              全屏预览
            </el-button>
          </div>
        </template>
        <div ref="cpuTrendRef" class="chart-box" />
      </el-card>
      <el-card shadow="never">
        <template #header>
          <div class="chart-card-header">
            <span>内存趋势</span>
            <el-button
              text
              size="small"
              :icon="useRenderIcon(Fullscreen)"
              @click="openChartPreview('memoryTrend', '内存趋势')"
            >
              全屏预览
            </el-button>
          </div>
        </template>
        <div ref="memoryTrendRef" class="chart-box" />
      </el-card>
      <el-card shadow="never">
        <template #header>
          <div class="chart-card-header">
            <span>磁盘趋势</span>
            <el-button
              text
              size="small"
              :icon="useRenderIcon(Fullscreen)"
              @click="openChartPreview('diskTrend', '磁盘趋势')"
            >
              全屏预览
            </el-button>
          </div>
        </template>
        <div ref="diskTrendRef" class="chart-box" />
      </el-card>
      <el-card shadow="never">
        <template #header>
          <div class="chart-card-header">
            <span>Load 趋势</span>
            <el-button
              text
              size="small"
              :icon="useRenderIcon(Fullscreen)"
              @click="openChartPreview('loadTrend', 'Load 趋势')"
            >
              全屏预览
            </el-button>
          </div>
        </template>
        <div ref="loadTrendRef" class="chart-box" />
      </el-card>
      <el-card shadow="never">
        <template #header>
          <div class="chart-card-header">
            <span>Swap 趋势</span>
            <el-button
              text
              size="small"
              :icon="useRenderIcon(Fullscreen)"
              @click="openChartPreview('swapTrend', 'Swap 趋势')"
            >
              全屏预览
            </el-button>
          </div>
        </template>
        <div ref="swapTrendRef" class="chart-box" />
      </el-card>
      <el-card shadow="never">
        <template #header>
          <div class="chart-card-header">
            <span>Goroutines 趋势</span>
            <el-button
              text
              size="small"
              :icon="useRenderIcon(Fullscreen)"
              @click="openChartPreview('goroutineTrend', 'Goroutines 趋势')"
            >
              全屏预览
            </el-button>
          </div>
        </template>
        <div ref="goroutineTrendRef" class="chart-box" />
      </el-card>
      <el-card shadow="never">
        <template #header>
          <div class="chart-card-header">
            <span>Heap Alloc 趋势</span>
            <el-button
              text
              size="small"
              :icon="useRenderIcon(Fullscreen)"
              @click="openChartPreview('heapTrend', 'Heap Alloc 趋势')"
            >
              全屏预览
            </el-button>
          </div>
        </template>
        <div ref="heapTrendRef" class="chart-box" />
      </el-card>
    </div>

    <div class="grid gap-4 xl:grid-cols-2 mb-4">
      <el-card shadow="never">
        <template #header>
          <div class="chart-card-header">
            <span>CPU Core 分布</span>
            <el-button
              text
              size="small"
              :icon="useRenderIcon(Fullscreen)"
              @click="openChartPreview('coreChart', 'CPU Core 分布')"
            >
              全屏预览
            </el-button>
          </div>
        </template>
        <div ref="coreChartRef" class="chart-box" />
      </el-card>
      <el-card shadow="never">
        <template #header>
          <div class="chart-card-header">
            <span>网络累计流量趋势</span>
            <el-button
              text
              size="small"
              :icon="useRenderIcon(Fullscreen)"
              @click="openChartPreview('networkChart', '网络累计流量趋势')"
            >
              全屏预览
            </el-button>
          </div>
        </template>
        <div ref="networkChartRef" class="chart-box" />
      </el-card>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <el-card shadow="never">
        <template #header><span>磁盘分区</span></template>
        <el-table :data="disks" size="small" stripe>
          <el-table-column prop="path" label="挂载点" min-width="120" />
          <el-table-column prop="fstype" label="文件系统" min-width="100" />
          <el-table-column label="总量" min-width="110">
            <template #default="{ row }">{{ formatBytes(row.total) }}</template>
          </el-table-column>
          <el-table-column label="已用" min-width="110">
            <template #default="{ row }">{{ formatBytes(row.used) }}</template>
          </el-table-column>
          <el-table-column label="剩余" min-width="110">
            <template #default="{ row }">{{ formatBytes(row.free) }}</template>
          </el-table-column>
          <el-table-column label="使用率" min-width="110">
            <template #default="{ row }">{{
              formatPercent(row.usedPercent)
            }}</template>
          </el-table-column>
        </el-table>
      </el-card>
      <el-card shadow="never">
        <template #header><span>网络接口</span></template>
        <el-table :data="networks" size="small" stripe>
          <el-table-column prop="name" label="接口" min-width="110" />
          <el-table-column label="发送" min-width="120">
            <template #default="{ row }">{{
              formatBytes(row.bytesSent)
            }}</template>
          </el-table-column>
          <el-table-column label="接收" min-width="120">
            <template #default="{ row }">{{
              formatBytes(row.bytesRecv)
            }}</template>
          </el-table-column>
          <el-table-column prop="packetsSent" label="发包" min-width="90" />
          <el-table-column prop="packetsRecv" label="收包" min-width="90" />
          <el-table-column prop="errout" label="发送错误" min-width="90" />
          <el-table-column prop="errin" label="接收错误" min-width="90" />
          <el-table-column prop="dropout" label="发送丢包" min-width="90" />
          <el-table-column prop="dropin" label="接收丢包" min-width="90" />
        </el-table>
      </el-card>
    </div>

    <div class="grid gap-4 xl:grid-cols-2 mt-4">
      <el-card shadow="never">
        <template #header><span>网络错误汇总</span></template>
        <div class="info-grid">
          <div>
            <span>接口数量</span>
            <strong>{{ networks.length }}</strong>
          </div>
          <div>
            <span>累计发送流量</span>
            <strong>{{ formatBytes(snapshot?.current?.netBytesSent) }}</strong>
          </div>
          <div>
            <span>累计接收流量</span>
            <strong>{{ formatBytes(snapshot?.current?.netBytesRecv) }}</strong>
          </div>
          <div>
            <span>错误总数</span>
            <strong>{{ formatInteger(totalNetErrors) }}</strong>
          </div>
          <div>
            <span>丢包总数</span>
            <strong>{{ formatInteger(totalNetDrops) }}</strong>
          </div>
        </div>
      </el-card>
      <el-card shadow="never">
        <template #header><span>当前采样</span></template>
        <div class="info-grid">
          <div>
            <span>CPU 使用率</span>
            <strong>{{ formatPercent(snapshot?.current?.cpuUsage) }}</strong>
          </div>
          <div>
            <span>内存使用率</span>
            <strong>{{
              formatPercent(snapshot?.current?.memoryUsedPercent)
            }}</strong>
          </div>
          <div>
            <span>Swap 使用率</span>
            <strong>{{
              formatPercent(snapshot?.current?.swapUsedPercent)
            }}</strong>
          </div>
          <div>
            <span>磁盘使用率</span>
            <strong>{{
              formatPercent(snapshot?.current?.diskUsedPercent)
            }}</strong>
          </div>
          <div>
            <span>Load1</span>
            <strong>{{ formatNumber(snapshot?.current?.load1) }}</strong>
          </div>
          <div>
            <span>Goroutines</span>
            <strong>{{ formatInteger(snapshot?.current?.goroutines) }}</strong>
          </div>
          <div>
            <span>Heap Alloc</span>
            <strong>{{ formatBytes(snapshot?.current?.heapAlloc) }}</strong>
          </div>
        </div>
      </el-card>
    </div>

    <div class="mt-4">
      <el-card shadow="never">
        <template #header><span>在线终端用户</span></template>
        <el-table :data="hostUsers" size="small" stripe>
          <el-table-column prop="user" label="用户" min-width="120" />
          <el-table-column prop="terminal" label="终端" min-width="120" />
          <el-table-column prop="host" label="来源" min-width="160" />
          <el-table-column label="登录时间" min-width="180">
            <template #default="{ row }">
              {{ formatUserStarted(row.started) }}
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <el-dialog
      v-model="previewVisible"
      :title="previewChartTitle"
      fullscreen
      append-to-body
      class="chart-preview-dialog"
      @opened="handlePreviewOpened"
      @closed="handlePreviewClosed"
    >
      <div class="chart-preview-toolbar">
        <div class="chart-preview-hint">
          点击图表点位可固定提示，点击空白区域取消固定
        </div>
        <div class="chart-preview-actions">
          <el-button
            v-if="previewPinnedTip"
            size="small"
            @click="clearPreviewPinnedTip"
          >
            取消固定
          </el-button>
          <el-button
            size="small"
            type="primary"
            :icon="useRenderIcon(Download)"
            @click="exportPreviewChart"
          >
            导出图表
          </el-button>
        </div>
      </div>
      <div class="chart-preview-box">
        <div
          ref="previewChartRef"
          class="chart-preview-surface"
          style="width: 100%; height: 100%; min-height: 520px"
        />
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.server-monitor-page {
  .monitor-header {
    flex-wrap: wrap;
  }

  .header-title-row {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 4px;
  }

  .monitor-toolbar {
    display: flex;
    justify-content: flex-end;
  }

  .grid-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  .trend-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
  }

  .metric {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.2;
  }

  .chart-card-header {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .sub {
    margin-top: 6px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .card-title {
    display: flex;
    gap: 8px;
    align-items: center;
    font-weight: 600;
  }

  .chart-box {
    width: 100%;
    height: 300px;
  }

  :deep(.chart-preview-dialog .el-dialog__body) {
    padding-top: 8px;
    padding-bottom: 12px;
  }

  :deep(.chart-preview-dialog .chart-preview-box) {
    width: 100%;
    height: calc(100vh - 172px);
    min-height: 520px;
    padding: 0 12px 12px;
  }

  :deep(.chart-preview-dialog .chart-preview-surface) {
    width: 100%;
    height: 100%;
    min-height: 520px;
    background: var(--el-bg-color);
    border-radius: 12px;
    box-shadow: 0 18px 50px rgb(15 23 42 / 12%);
  }

  :deep(.chart-preview-dialog .chart-preview-toolbar) {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px 12px;
  }

  :deep(.chart-preview-dialog .chart-preview-hint) {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  :deep(.chart-preview-dialog .chart-preview-actions) {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    align-items: center;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;

    div {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    span {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    strong {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
  }

  .progress-label {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 13px;
  }
}
</style>
