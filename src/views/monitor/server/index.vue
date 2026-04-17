<script setup lang="ts">
import dayjs from "dayjs";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useDark, useECharts } from "@pureadmin/utils";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { baseUrlApi } from "@/api/utils";
import { getServerMonitor, type ServerMonitorResult } from "@/api/system";
import { getToken } from "@/utils/auth";

import Refresh from "~icons/ep/refresh";
import Monitor from "~icons/ri/pulse-line";
import Cpu from "~icons/ri/cpu-line";
import HardDrive from "~icons/ri/hard-drive-2-line";
import Database from "~icons/ri/database-2-line";
import Global from "~icons/ri/global-line";

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
const socketRef = ref<WebSocket | null>(null);
const streamRetryMs = ref(3000);
let disposed = false;
let activeStreamSeq = 0;

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

const snapshot = computed(() => monitor.value?.snapshot);
const host = computed(() => snapshot.value?.host);
const cpu = computed(() => snapshot.value?.cpu);
const memory = computed(() => snapshot.value?.memory);
const swap = computed(() => snapshot.value?.swap);
const disks = computed(() => snapshot.value?.disks ?? []);
const networks = computed(() => snapshot.value?.network ?? []);
const goRuntime = computed(() => snapshot.value?.goRuntime);
const history = computed(() => monitor.value?.history ?? []);
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

function baseLineTrendOption(
  title: string,
  color: string,
  values: number[],
  valueFormatter: (value: number) => string,
  yAxisFormatter: (value: number) => string
) {
  const labels = history.value.map(item =>
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
  const labels = history.value.map(item =>
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
  setCpuTrendOptions(
    basePercentTrendOption(
      "CPU",
      "#ef4444",
      history.value.map(item => item.cpuUsage)
    )
  );

  setMemoryTrendOptions(
    basePercentTrendOption(
      "Memory",
      "#2563eb",
      history.value.map(item => item.memoryUsedPercent)
    )
  );

  setDiskTrendOptions(
    basePercentTrendOption(
      "Disk",
      "#f59e0b",
      history.value.map(item => item.diskUsedPercent)
    )
  );

  const labels = history.value.map(item =>
    dayjs(item.timestamp).format("HH:mm:ss")
  );

  setLoadTrendOptions({
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
        data: history.value.map(item => Number(item.load1.toFixed(2)))
      }
    ]
  });

  setSwapTrendOptions(
    basePercentTrendOption(
      "Swap",
      "#f97316",
      history.value.map(item => item.swapUsedPercent)
    )
  );

  setGoroutineTrendOptions(
    baseLineTrendOption(
      "Goroutines",
      "#14b8a6",
      history.value.map(item => item.goroutines),
      value => formatInteger(Number(value ?? 0)),
      value => formatInteger(Number(value ?? 0))
    )
  );

  setHeapTrendOptions(
    baseLineTrendOption(
      "Heap",
      "#6366f1",
      history.value.map(item => item.heapAlloc),
      value => formatBytes(Number(value ?? 0)),
      value => formatBytes(Number(value ?? 0))
    )
  );

  setCoreOptions({
    animation: false,
    tooltip: {
      trigger: "axis" as const,
      valueFormatter: (value: number) => `${Number(value ?? 0).toFixed(2)}%`
    },
    grid: { left: 48, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: "category" as const,
      data: (cpu.value?.coreUsages ?? []).map((_, index) => `Core ${index + 1}`)
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
  });

  setNetworkOptions({
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
        data: history.value.map(item => item.netBytesSent)
      },
      {
        name: "Recv",
        type: "line" as const,
        smooth: true,
        showSymbol: false,
        data: history.value.map(item => item.netBytesRecv)
      }
    ]
  });
}

function stopMonitorStream() {
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
  reconnectTimer.value = window.setTimeout(() => {
    reconnectTimer.value = null;
    startMonitorStream();
  }, streamRetryMs.value);
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
    history: nextHistory.slice(-90)
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
  const token = getToken()?.accessToken;
  if (!token) {
    streamStatus.value = "disconnected";
    return;
  }

  const streamSeq = ++activeStreamSeq;
  const socket = new WebSocket(buildWebSocketUrl(token));
  socketRef.value = socket;

  socket.onopen = () => {
    if (
      socketRef.value !== socket ||
      disposed ||
      streamSeq !== activeStreamSeq
    ) {
      socket.close();
      return;
    }
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
    streamStatus.value = "disconnected";
    socket.close();
  };

  socket.onclose = () => {
    if (socketRef.value === socket) {
      socketRef.value = null;
    }
    if (!disposed && streamSeq === activeStreamSeq) {
      streamStatus.value = "disconnected";
      scheduleReconnect();
    }
  };
}

function handleWebSocketMessage(raw: string) {
  const message = JSON.parse(raw) as ServerMonitorWsMessage;
  if (!message?.event || !message.data) return;
  applyStreamPayload(message.event, message.data);
}

async function manualRefresh() {
  await fetchMonitor();
}

onMounted(async () => {
  await fetchMonitor();
  startMonitorStream();
});

onBeforeUnmount(() => {
  disposed = true;
  stopMonitorStream();
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
        <template #header><span>CPU 趋势</span></template>
        <div ref="cpuTrendRef" class="chart-box" />
      </el-card>
      <el-card shadow="never">
        <template #header><span>内存趋势</span></template>
        <div ref="memoryTrendRef" class="chart-box" />
      </el-card>
      <el-card shadow="never">
        <template #header><span>磁盘趋势</span></template>
        <div ref="diskTrendRef" class="chart-box" />
      </el-card>
      <el-card shadow="never">
        <template #header><span>Load 趋势</span></template>
        <div ref="loadTrendRef" class="chart-box" />
      </el-card>
      <el-card shadow="never">
        <template #header><span>Swap 趋势</span></template>
        <div ref="swapTrendRef" class="chart-box" />
      </el-card>
      <el-card shadow="never">
        <template #header><span>Goroutines 趋势</span></template>
        <div ref="goroutineTrendRef" class="chart-box" />
      </el-card>
      <el-card shadow="never">
        <template #header><span>Heap Alloc 趋势</span></template>
        <div ref="heapTrendRef" class="chart-box" />
      </el-card>
    </div>

    <div class="grid gap-4 xl:grid-cols-2 mb-4">
      <el-card shadow="never">
        <template #header><span>CPU Core 分布</span></template>
        <div ref="coreChartRef" class="chart-box" />
      </el-card>
      <el-card shadow="never">
        <template #header><span>网络累计流量趋势</span></template>
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
