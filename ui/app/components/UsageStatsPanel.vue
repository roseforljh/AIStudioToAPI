<template>
    <div class="view-container usage-panel">
        <header class="page-header">
            <h1>{{ zh ? "使用统计" : "Usage statistics" }}</h1>
            <el-select v-model="windowMs" class="usage-range" :aria-label="zh ? '统计时间范围' : 'Time range'">
                <el-option :value="3600000" :label="zh ? '最近 1 小时' : 'Last hour'" />
                <el-option :value="86400000" :label="zh ? '最近 24 小时' : 'Last 24 hours'" />
                <el-option :value="604800000" :label="zh ? '最近 7 天' : 'Last 7 days'" />
                <el-option :value="0" :label="zh ? '全部' : 'All time'" />
            </el-select>
        </header>
        <div class="usage-totals">
            <div class="status-card">
                <span>{{ zh ? "请求次数" : "Requests" }}</span
                ><strong>{{ summary.totalRequests }}</strong>
            </div>
            <div class="status-card">
                <span>{{ zh ? "成功率" : "Success rate" }}</span
                ><strong>{{ summary.successRate }}%</strong>
            </div>
        </div>
        <section class="status-card">
            <h3>{{ zh ? "最近请求账号与模型" : "Recent accounts and models" }}</h3>
            <p class="usage-note">
                {{
                    zh
                        ? "按最近请求排序；仅统计模型生成请求，成功率 = 成功次数 / 请求次数。"
                        : "Most recent first. Generation requests only; success rate = successful / total requests."
                }}
            </p>
            <div class="usage-table-scroll">
                <table class="usage-table">
                    <thead>
                        <tr>
                            <th>{{ zh ? "账号" : "Account" }}</th>
                            <th>{{ zh ? "模型" : "Model" }}</th>
                            <th>{{ zh ? "次数" : "Requests" }}</th>
                            <th>{{ zh ? "成功率" : "Success rate" }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in visibleRows" :key="item.key">
                            <td>
                                {{ item.authIndex === null ? "" : `#${item.authIndex} ` }}{{ item.accountName || "—" }}
                            </td>
                            <td>{{ item.model }}</td>
                            <td>{{ item.totalRequests }}</td>
                            <td>{{ item.successRate }}%</td>
                        </tr>
                        <tr v-if="!summary.rows.length">
                            <td colspan="4">{{ zh ? "暂无请求记录" : "No requests yet" }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-if="totalPages > 1" class="usage-pagination">
                <el-button :disabled="page === 1" @click="page--">{{ zh ? "上一页" : "Previous" }}</el-button>
                <span>{{ page }} / {{ totalPages }}</span>
                <el-button :disabled="page === totalPages" @click="page++">{{ zh ? "下一页" : "Next" }}</el-button>
            </div>
        </section>
    </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { summarizeUsage } from "../utils/usageSummary.mjs";
const props = defineProps({ lang: { default: "zh", type: String }, records: { default: () => [], type: Array } });
const zh = computed(() => props.lang === "zh");
const windowMs = ref(86400000);
const summary = computed(() => summarizeUsage(props.records, windowMs.value));
const page = ref(1);
const pageSize = 20;
const totalPages = computed(() => Math.max(1, Math.ceil(summary.value.rows.length / pageSize)));
const visibleRows = computed(() => summary.value.rows.slice((page.value - 1) * pageSize, page.value * pageSize));
watch(windowMs, () => {
    page.value = 1;
});
watch(totalPages, value => {
    page.value = Math.min(page.value, value);
});
</script>

<style scoped>
.usage-range {
    width: 170px;
}
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
}
.usage-totals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 20px;
}
.status-card {
    padding: 20px;
    border: 1px solid var(--border-light);
    border-radius: 14px;
    background: var(--bg-card);
}
.usage-totals span {
    display: block;
    color: var(--text-secondary);
    margin-bottom: 8px;
}
.usage-totals strong {
    font-size: 28px;
}
h3 {
    margin: 0 0 10px;
}
.usage-note {
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.6;
    margin: 0 0 16px;
}
.usage-table-scroll {
    overflow-x: auto;
}
.usage-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 14px;
}
.usage-table th,
.usage-table td {
    padding: 14px 10px;
    border-bottom: 1px solid var(--border-light);
}
.usage-table th {
    color: var(--text-secondary);
    font-weight: 500;
    white-space: nowrap;
}
.usage-table td:first-child,
.usage-table td:nth-child(2) {
    overflow-wrap: anywhere;
    min-width: 140px;
}
.usage-pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-top: 20px;
}
@media (max-width: 600px) {
    .status-card {
        padding: 14px;
    }
    .usage-totals {
        gap: 10px;
    }
    .usage-table {
        font-size: 13px;
    }
}
</style>
