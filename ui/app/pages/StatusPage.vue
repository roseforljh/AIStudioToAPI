<!--
 * File: ui/app/pages/StatusPage.vue
 * Description: Status page component for displaying system status and logs
 *
 * Author: Ellinav, iBenzene, bbbugg
-->

<template>
    <div class="main-layout">
        <!-- Sidebar Navigation -->
        <aside class="sidebar">
            <div class="sidebar-menu">
                <button
                    class="menu-item"
                    :class="{ active: activeTab === 'home' }"
                    :title="t('statusHeading')"
                    @click="switchTab('home')"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                </button>
                <button
                    class="menu-item"
                    :class="{ active: activeTab === 'settings' }"
                    :title="t('actionsPanel')"
                    @click="switchTab('settings')"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle cx="12" cy="12" r="3"></circle>
                        <path
                            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                        ></path>
                    </svg>
                </button>
                <button
                    class="menu-item"
                    :class="{ active: activeTab === 'logs' }"
                    :title="t('realtimeLogs')"
                    @click="switchTab('logs')"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                </button>
                <button
                    class="menu-item"
                    :class="{ active: activeTab === 'stats' }"
                    :title="t('usageStats')"
                    @click="switchTab('stats')"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M3 3v18h18"></path>
                        <path d="M7 16l4-4 3 3 5-7"></path>
                    </svg>
                </button>
            </div>

            <div class="sidebar-footer">
                <button
                    class="menu-item"
                    :title="t('switchLanguage')"
                    @click="handleLanguageChange(state.currentLang === 'en' ? 'zh' : 'en')"
                >
                    <svg
                        data-v-3ee666f0=""
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path data-v-3ee666f0="" d="m5 8 6 6"></path>
                        <path data-v-3ee666f0="" d="m4 14 6-6 2-3"></path>
                        <path data-v-3ee666f0="" d="M2 5h12"></path>
                        <path data-v-3ee666f0="" d="M7 2h1"></path>
                        <path data-v-3ee666f0="" d="m22 22-5-10-5 10"></path>
                        <path data-v-3ee666f0="" d="M14 18h6"></path>
                    </svg>
                </button>
                <button class="menu-item logout-button" :title="t('logout')" @click="handleLogout">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </button>
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="content-area">
            <!-- HOME VIEW -->
            <div v-if="activeTab === 'home'" class="view-container">
                <header class="page-header">
                    <h1>{{ t("statusHeading") }}</h1>
                </header>

                <div class="overview-grid">
                    <section class="status-card overview-card">
                        <h3 class="card-title">{{ state.currentLang === 'zh' ? '运行概览' : 'Service overview' }}</h3>
                        <div class="overview-metrics">
                            <div class="overview-metric"><span class="label">{{ t("serviceConnection") }}</span><strong :class="serviceConnectedClass">{{ serviceConnectedText }}</strong></div>
                            <div class="overview-metric"><span class="label">{{ t("browserConnection") }}</span><strong :class="browserConnectedClass">{{ browserConnectedText }}</strong></div>
                            <div class="overview-metric"><span class="label">{{ state.currentLang === 'zh' ? '已登录账号' : 'Connected accounts' }}</span><strong>{{ state.accountDetails.filter(item => item.isReady).length }} / {{ state.maxContexts || '∞' }}</strong></div>
                            <div class="overview-metric"><span class="label">VIP · {{ state.currentLang === 'zh' ? '活跃 / 预备' : 'Active / standby' }}</span><strong><span class="overview-active">{{ state.accountDetails.filter(item => item.benefitState === 'ready-paid' && item.isActive).length }}</span> / <span class="overview-standby">{{ state.accountDetails.filter(item => item.benefitState === 'ready-paid' && item.isStandby).length }}</span></strong></div>
                            <div class="overview-metric"><span class="label">{{ state.currentLang === 'zh' ? '普通 · 活跃 / 预备' : 'Standard · Active / standby' }}</span><strong><span class="overview-active">{{ state.accountDetails.filter(item => item.benefitState !== 'ready-paid' && item.isActive).length }}</span> / <span class="overview-standby">{{ state.accountDetails.filter(item => item.benefitState !== 'ready-paid' && item.isStandby).length }}</span></strong></div>
                            <div class="overview-metric"><span class="label">{{ t("loadBalancerConcurrency") }}</span><strong>{{ state.accountLoadBalancerActiveRequests }} / {{ state.accountLoadBalancerLimit || '−' }}</strong></div>
                            <div class="overview-metric"><span class="label">{{ t("requestsLastMinute") }}</span><strong>{{ state.requestsLastMinute }}</strong></div>
                        </div>
                    </section>
                </div>

                <!-- Account Management Section (Full Width) -->
                <div v-if="state.serviceConnected" class="full-width-section">
                    <div class="status-card">
                        <h3 class="card-title">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                style="margin-right: 8px; vertical-align: text-bottom"
                            >
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            {{ t("accountManagement") }}
                        </h3>
                        <!-- Top action buttons: Add and Deduplicate -->
                        <div class="action-group account-top-actions">
                            <input
                                ref="fileInput"
                                type="file"
                                style="display: none"
                                accept=".json,.zip"
                                multiple
                                @change="handleFileUpload"
                            />
                            <!-- Left: Select all and batch delete -->
                            <div class="batch-actions">
                                <el-checkbox
                                    :model-value="isAllSelected"
                                    :indeterminate="hasSelection && !isAllSelected"
                                    :disabled="state.accountDetails.length === 0"
                                    @change="toggleSelectAll"
                                >
                                    {{ t("selectAll") }}
                                </el-checkbox>
                                <button
                                    type="button"
                                    class="btn-select-invalid"
                                    :disabled="isBusy || state.accountDetails.length === 0"
                                    title="只选择认证失效或文件格式错误；不选择超时、限流和中断。不会直接删除。"
                                    @click="selectInvalidAuthAccounts"
                                >
                                    选择明确失效账号
                                </button>
                                <span v-if="hasSelection" class="selected-count">
                                    {{ t("selectedCount", { count: selectedCount }) }}
                                </span>
                                <button
                                    v-if="hasSelection"
                                    class="btn-batch-delete"
                                    :disabled="isBusy"
                                    :title="t('batchDelete')"
                                    @click="batchDeleteAccounts"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <path
                                            d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
                                        />
                                        <path d="m9.5 10 5 5" />
                                        <path d="m14.5 10-5 5" />
                                    </svg>
                                </button>
                                <button
                                    v-if="hasSelection"
                                    class="btn-batch-download"
                                    :title="t('batchDownload')"
                                    @click="batchDownloadAccounts"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <path
                                            d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
                                        />
                                        <path d="M12 10v6" />
                                        <path d="m9 13 3 3 3-3" />
                                    </svg>
                                </button>
                            </div>
                            <!-- Right: Add, upload, and deduplicate -->
                            <div class="icon-buttons">
                                <button :disabled="isBusy" :title="t('btnAddUser')" @click="addUser">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="8.5" cy="7" r="4"></circle>
                                        <line x1="20" y1="8" x2="20" y2="14"></line>
                                        <line x1="23" y1="11" x2="17" y2="11"></line>
                                    </svg>
                                </button>
                                <button :disabled="isBusy" :title="t('uploadFile')" @click="triggerFileUpload">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="17 8 12 3 7 8"></polyline>
                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                    </svg>
                                </button>
                                <button
                                    class="btn-warning"
                                    :disabled="isBusy"
                                    :title="t('btnDeduplicateAuth')"
                                    @click="deduplicateAuth"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="benefit-scan-panel" aria-live="polite">
                            <div class="benefit-toolbar">
                                <el-button :loading="benefitChecking || state.benefitScan.running" :disabled="state.benefitScan.running" @click="checkBenefits">{{ state.benefitScan.running ? (state.currentLang === 'zh' ? '正在检测' : 'Checking') : (state.currentLang === 'zh' ? '重新检测全部账号权益' : 'Recheck all account benefits') }}</el-button>
                                <small>{{ state.currentLang === 'zh' ? '自动逐个检测并保存，结果会实时归组。' : 'Accounts are checked and grouped automatically.' }}</small>
                            </div>
                            <div v-if="showBenefitProgress" class="benefit-progress">
                                <div class="benefit-progress-heading"><strong>{{ state.benefitScan.running ? (state.currentLang === 'zh' ? '检测进度' : 'Scan progress') : (state.benefitScan.error ? (state.currentLang === 'zh' ? '检测中断' : 'Scan interrupted') : (state.currentLang === 'zh' ? '本轮检测完成' : 'Scan complete')) }}</strong><span>{{ state.benefitScan.completed }} / {{ state.benefitScan.total }}</span></div>
                                <el-progress :percentage="benefitProgressPercent" :stroke-width="9" :show-text="false" :status="state.benefitScan.error ? 'exception' : undefined" />
                                <div class="benefit-progress-caption">{{ state.benefitScan.running && state.benefitScan.currentIndex !== null ? (state.currentLang === 'zh' ? `正在检测账号 #${state.benefitScan.currentIndex}` : `Checking account #${state.benefitScan.currentIndex}`) : (state.benefitScan.running ? (state.currentLang === 'zh' ? '正在准备检测…' : 'Preparing scan…') : (state.benefitScan.error ? (state.currentLang === 'zh' ? '请稍后重新检测' : 'Please retry') : (state.currentLang === 'zh' ? '已按结果更新分组' : 'Groups updated'))) }}</div>
                            </div>
                        </div>
                        <!-- Group only confirmed observations; unknown is never inferred as free. -->
                        <section v-for="group in accountBenefitGroups" :key="group.key" class="account-benefit-group">
                            <h4 class="account-group-title" :class="`group-${group.key}`">{{ group.label }} <span>{{ group.items.length }}</span></h4>
                            <div class="account-list">
                            <div
                                v-for="item in group.items"
                                :key="item.index"
                                class="account-list-item"
                                style="cursor: pointer"
                                :class="{
                                    'is-current': item.index === state.currentAuthIndex,
                                    'is-selected': isAccountSelected(item.index),
                                }"
                                @click="toggleSelectAccount(item.index)"
                            >
                                <el-checkbox
                                    :model-value="isAccountSelected(item.index)"
                                    class="account-checkbox"
                                    :aria-label="`Select account #${item.index}`"
                                    @change="toggleSelectAccount(item.index)"
                                    @click.stop
                                />
                                <el-tooltip
                                    :content="getAccountDisplayName(item)"
                                    placement="top"
                                    effect="dark"
                                    :hide-after="0"
                                >
                                    <div class="account-info">
                                        <span class="account-index">#{{ item.index }}</span>
                                        <span
                                            class="account-email"
                                            :class="{ 'is-error': item.isInvalid, 'is-duplicate': item.isDuplicate }"
                                        >
                                            {{ getAccountDisplayName(item) }}
                                        </span>
                                        <span v-if="item.index === state.currentAuthIndex" class="current-badge">
                                            {{ t("tagCurrent") }}
                                        </span>
                                        <span v-if="state.accountLoadBalancingEnabled && item.isActive && item.index !== state.currentAuthIndex" class="standby-badge">{{ state.currentLang === 'zh' ? '活跃' : 'Active' }}</span>
                                        <span v-if="state.accountLoadBalancingEnabled && item.isStandby" class="standby-badge">{{ state.currentLang === 'zh' ? '预备' : 'Standby' }}</span>
                                        <span v-if="item.benefitState === 'ready-paid'" class="benefit-paid">{{ state.currentLang === 'zh' ? '付费权益' : 'Paid benefit' }}</span>
                                        <span v-else-if="item.benefitState === 'ready-free'" class="benefit-free">{{ state.currentLang === 'zh' ? '普通' : 'Standard' }}</span>
                                        <span v-if="item.accountIssue" class="account-health-issue"
                                            :class="{ 'is-permanent': item.accountIssue.deletable }"
                                            :title="'auth-' + item.index + '.json · ' + item.accountIssue.code + ': ' + item.accountIssue.message">
                                            {{ item.accountIssue.deletable ? '认证错误：' : '临时异常：' }}{{ item.accountIssue.message }}
                                        </span>
                                        <span v-if="item.isExpired" class="expired-badge">
                                            {{ t("tagExpired") }}
                                        </span>
                                    </div>
                                </el-tooltip>
                                <div class="account-actions">
                                    <button
                                        class="btn-switch"
                                        :class="{
                                            'is-active': item.index === state.currentAuthIndex,
                                            'is-fast': state.accountLoadBalancingEnabled ? item.isStandby : item.isReady && item.index !== state.currentAuthIndex,
                                        }"
                                        :disabled="isBusy || (item.index === state.currentAuthIndex)"
                                        :title="
                                            (item.index === state.currentAuthIndex)
                                                ? t('currentAccount')
                                                : item.hasContext
                                                  ? t('fastSwitch')
                                                  : t('btnSwitchAccount')
                                        "
                                        @click.stop="switchAccountByIndex(item.index)"
                                    >
                                        <svg
                                            v-if="!(item.index === state.currentAuthIndex)"
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 1024 1024"
                                            fill="currentColor"
                                        >
                                            <path
                                                d="M886.2 604.8H137.8c-22.1 0-40 17.9-40 40 0 8.4 2.6 16.2 7 22.6 1.9 4.5 4.8 8.7 8.4 12.4L289.5 856c7.8 7.8 18 11.7 28.3 11.7s20.5-3.9 28.3-11.7c15.6-15.6 15.6-40.9 0-56.6L231.3 684.8h654.8c22.1 0 40-17.9 40-40s-17.8-40-39.9-40zM137.8 419.2h748.4c22.1 0 40-17.9 40-40 0-8.4-2.6-16.2-7-22.6-1.4-3.3-3.4-6.5-5.8-9.5L769.2 170.9c-14-17.1-39.2-19.6-56.3-5.6-17.1 14-19.6 39.2-5.6 56.3l96.3 117.6H137.8c-22.1 0-40 17.9-40 40s17.9 40 40 40z"
                                            ></path>
                                        </svg>
                                        <svg
                                            v-else
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        >
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    </button>
                                    <button
                                        class="btn-danger"
                                        :disabled="isBusy"
                                        :title="t('btnDeleteUser')"
                                        @click.stop="deleteAccountByIndex(item.index)"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        >
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path
                                                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                                            ></path>
                                            <line x1="10" y1="11" x2="10" y2="17"></line>
                                            <line x1="14" y1="11" x2="14" y2="17"></line>
                                        </svg>
                                    </button>
                                    <el-dropdown trigger="click" @command="command => handleAccountMenu(command, item.index)">
                                        <button class="btn-more" :title="state.currentLang === 'zh' ? '更多操作' : 'More actions'" @click.stop aria-label="More actions">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                                        </button>
                                        <template #dropdown><el-dropdown-menu><el-dropdown-item command="models">{{ state.currentLang === 'zh' ? '检测模型' : 'Check models' }}</el-dropdown-item><el-dropdown-item command="benefit">{{ state.currentLang === 'zh' ? '检测付费权益' : 'Check paid benefit' }}</el-dropdown-item><el-dropdown-item command="download">{{ t('download') }}</el-dropdown-item></el-dropdown-menu></template>
                                    </el-dropdown>
                                </div>
                            </div>
                            <div v-if="group.items.length === 0" class="account-list-empty">{{ state.currentLang === 'zh' ? '暂无账号' : 'No accounts' }}</div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            <!-- SETTINGS VIEW -->
            <div v-if="activeTab === 'settings'" class="view-container">
                <header class="page-header">
                    <h1>{{ t("settings") }}</h1>
                </header>

                <div class="dashboard-grid settings-grid">
                    <!-- Fork build information -->
                    <div class="status-card">
                        <h3 class="card-title">{{ t("versionInfo") }}</h3>
                        <div class="status-list">
                            <div class="status-item"><span class="label">GitHub</span><a class="repo-link" href="https://github.com/roseforljh/AIStudioToAPI" target="_blank" rel="noopener noreferrer">roseforljh/AIStudioToAPI</a></div>
                            <div class="status-item"><span class="label">{{ state.currentLang === 'zh' ? '分支' : 'Branch' }}</span><a class="repo-link" href="https://github.com/roseforljh/AIStudioToAPI/tree/feat/account-load-balancer" target="_blank" rel="noopener noreferrer">feat/account-load-balancer</a></div>
                            <div class="status-item"><span class="label">{{ t("currentVersion") }}</span><span class="value clickable-version" :title="t('copy')" @click="copyAppVersion">{{ appVersion }}</span></div>
                            <div class="version-note">{{ state.currentLang === 'zh' ? '当前为 fork 本地构建；不以官方发布版本代表 fork 更新状态。' : 'Local fork build; upstream releases do not indicate fork update status.' }}</div>
                        </div>
                    </div>

                    <div class="status-card account-pool-settings">
                        <h3 class="card-title">{{ state.currentLang === 'zh' ? '账号池设置' : 'Account pools' }}</h3>
                        <p class="pool-settings-hint">{{ state.currentLang === 'zh' ? '分别设置付费组与普通组的活跃账号和预备账号数量，保存后立即生效。未确认权益的账号暂放普通组。' : 'Set active and standby counts by group. Unconfirmed accounts are shown in Standard.' }}</p>
                        <div class="pool-settings-grid">
                            <strong>{{ state.currentLang === 'zh' ? '付费组' : 'Paid' }}</strong><label>{{ state.currentLang === 'zh' ? '活跃' : 'Active' }}<el-input-number v-model="poolSettings.paidActive" :min="0" :max="30" size="small" /></label><label>{{ state.currentLang === 'zh' ? '预备' : 'Standby' }}<el-input-number v-model="poolSettings.paidStandby" :min="0" :max="30" size="small" /></label>
                            <strong>{{ state.currentLang === 'zh' ? '普通组' : 'Standard' }}</strong><label>{{ state.currentLang === 'zh' ? '活跃' : 'Active' }}<el-input-number v-model="poolSettings.normalActive" :min="0" :max="30" size="small" /></label><label>{{ state.currentLang === 'zh' ? '预备' : 'Standby' }}<el-input-number v-model="poolSettings.normalStandby" :min="0" :max="30" size="small" /></label>
                        </div><el-button type="primary" :loading="poolSaving" @click="savePoolSettings">{{ state.currentLang === 'zh' ? '保存账号池设置' : 'Save account pools' }}</el-button>
                    </div>

                    <!-- System Settings Card -->
                    <div class="status-card">
                        <h3 class="card-title">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                style="margin-right: 8px; vertical-align: text-bottom"
                            >
                                <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                                <path d="M7 8h10"></path>
                                <path d="M7 12h10"></path>
                                <path d="M7 16h6"></path>
                            </svg>
                            {{ t("systemSettings") }}
                        </h3>
                        <div class="settings-switches">
                            <div class="switch-container">
                                <span class="label">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        style="margin-right: 6px; vertical-align: middle"
                                    >
                                        <circle cx="6" cy="12" r="3"></circle>
                                        <circle cx="18" cy="6" r="3"></circle>
                                        <circle cx="18" cy="18" r="3"></circle>
                                        <path d="M8.6 10.5l6.8-3"></path>
                                        <path d="M8.6 13.5l6.8 3"></path>
                                    </svg>
                                    <span>
                                        {{ t("accountLoadBalancing") }}
                                        <EnvVarTooltip env-var="ACCOUNT_LOAD_BALANCING" doc-section="proxy-config" />
                                        <small class="setting-description">
                                            {{
                                                t("accountLoadBalancingDescription", {
                                                    count: state.accountMaxConcurrentRequests,
                                                })
                                            }}
                                        </small>
                                    </span>
                                </span>
                                <el-switch
                                    v-model="state.accountLoadBalancingEnabled"
                                    :width="50"
                                    :before-change="handleAccountLoadBalancingBeforeChange"
                                />
                            </div>
                            <div class="switch-container">
                                <span class="label">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        style="margin-right: 6px; vertical-align: middle"
                                    >
                                        <path d="M12 3v18"></path>
                                        <path d="M17 8l-5-5-5 5"></path>
                                        <path d="M17 16l-5 5-5-5"></path>
                                    </svg>
                                    <span>
                                        {{ t("enableAuthUpdate") }}
                                        <EnvVarTooltip env-var="ENABLE_AUTH_UPDATE" doc-section="proxy-config" />
                                    </span>
                                </span>
                                <el-switch
                                    v-model="state.enableAuthUpdateEnabled"
                                    :width="50"
                                    :before-change="handleEnableAuthUpdateBeforeChange"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Log Settings Card -->
                    <div class="status-card">
                        <h3 class="card-title">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                style="margin-right: 8px; vertical-align: text-bottom"
                            >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                            {{ t("log") }}
                        </h3>
                        <div class="status-list">
                            <div class="status-item">
                                <span class="label">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        style="margin-right: 6px; vertical-align: middle"
                                    >
                                        <line x1="8" y1="6" x2="21" y2="6"></line>
                                        <line x1="8" y1="12" x2="21" y2="12"></line>
                                        <line x1="8" y1="18" x2="21" y2="18"></line>
                                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                                    </svg>
                                    <span>
                                        {{ t("logLevel") }}
                                        <EnvVarTooltip env-var="LOG_LEVEL" doc-section="app-config" />
                                    </span>
                                </span>
                                <el-select
                                    v-model="state.debugModeEnabled"
                                    style="width: 120px"
                                    @change="handleStatsDebugChange"
                                >
                                    <el-option :label="t('normal')" :value="false" />
                                    <el-option :label="t('debug')" :value="true" />
                                </el-select>
                            </div>
                            <div class="status-item">
                                <span class="label">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        style="margin-right: 6px; vertical-align: middle"
                                    >
                                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                        <line x1="8" y1="21" x2="16" y2="21"></line>
                                        <line x1="12" y1="17" x2="12" y2="21"></line>
                                    </svg>
                                    {{ t("logMaxCount") }}
                                </span>
                                <el-input-number
                                    v-model="state.logMaxCount"
                                    :min="1"
                                    :max="1000"
                                    style="width: 120px"
                                    @change="handleLogMaxCountChange"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Appearance Card -->
                    <div class="status-card">
                        <h3 class="card-title">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                style="margin-right: 8px; vertical-align: text-bottom"
                            >
                                <circle cx="12" cy="12" r="5"></circle>
                                <line x1="12" y1="1" x2="12" y2="3"></line>
                                <line x1="12" y1="21" x2="12" y2="23"></line>
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                <line x1="1" y1="12" x2="3" y2="12"></line>
                                <line x1="21" y1="12" x2="23" y2="12"></line>
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                            </svg>
                            {{ t("appearance") }}
                        </h3>
                        <div class="status-list">
                            <div class="status-item">
                                <span class="label">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        style="margin-right: 6px; vertical-align: middle"
                                    >
                                        <circle cx="12" cy="12" r="5"></circle>
                                        <line x1="12" y1="1" x2="12" y2="3"></line>
                                        <line x1="12" y1="21" x2="12" y2="23"></line>
                                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                        <line x1="1" y1="12" x2="3" y2="12"></line>
                                        <line x1="21" y1="12" x2="23" y2="12"></line>
                                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                                    </svg>
                                    {{ t("theme") }}
                                </span>
                                <el-select :model-value="theme" style="width: 150px" @update:model-value="setTheme">
                                    <el-option :label="t('followSystem')" value="auto" />
                                    <el-option :label="t('light')" value="light" />
                                    <el-option :label="t('dark')" value="dark" />
                                </el-select>
                            </div>
                            <div class="status-item">
                                <span class="label">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        style="margin-right: 6px; vertical-align: middle"
                                    >
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="2" y1="12" x2="22" y2="12"></line>
                                        <path
                                            d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
                                        ></path>
                                    </svg>
                                    {{ t("language") }}
                                </span>
                                <el-select
                                    v-model="state.currentLang"
                                    style="width: 150px"
                                    @change="handleLanguageChange"
                                >
                                    <el-option label="中文" value="zh" />
                                    <el-option label="English" value="en" />
                                </el-select>
                            </div>
                        </div>
                    </div>

                    <!-- Proxy Settings Card -->
                    <div class="status-card">
                        <h3 class="card-title">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                style="margin-right: 8px; vertical-align: text-bottom"
                            >
                                <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"></path>
                            </svg>
                            {{ t("proxySettings") }}
                        </h3>
                        <div class="settings-switches">
                            <div class="switch-container">
                                <span class="label">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        style="margin-right: 6px; vertical-align: middle"
                                    >
                                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                    </svg>
                                    {{ t("streamingMode") }}
                                </span>
                                <el-switch
                                    v-model="state.streamingModeReal"
                                    inline-prompt
                                    :width="50"
                                    :active-text="t('real')"
                                    :inactive-text="t('fake')"
                                    :before-change="handleStreamingModeBeforeChange"
                                />
                            </div>
                            <div class="switch-container">
                                <span class="label">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        style="margin-right: 6px; vertical-align: middle"
                                    >
                                        <path d="M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8"></path>
                                        <path d="M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8"></path>
                                        <path d="M17.5 16a3.5 3.5 0 0 0 0 -7h-.5"></path>
                                        <path d="M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0"></path>
                                        <path d="M6.5 16a3.5 3.5 0 0 1 0 -7h.5"></path>
                                        <path d="M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10"></path>
                                    </svg>
                                    {{ t("forceThinking") }}
                                </span>
                                <el-switch
                                    v-model="state.forceThinkingEnabled"
                                    :width="50"
                                    :before-change="handleForceThinkingBeforeChange"
                                />
                            </div>
                            <div class="switch-container">
                                <span class="label">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        style="margin-right: 6px; vertical-align: middle"
                                    >
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="2" y1="12" x2="22" y2="12"></line>
                                        <path
                                            d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
                                        ></path>
                                    </svg>
                                    {{ t("forceWebSearch") }}
                                </span>
                                <el-switch
                                    v-model="state.forceWebSearchEnabled"
                                    :width="50"
                                    :before-change="handleForceWebSearchBeforeChange"
                                />
                            </div>
                            <div class="switch-container">
                                <span class="label">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        style="margin-right: 6px; vertical-align: middle"
                                    >
                                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                    </svg>
                                    {{ t("forceUrlContext") }}
                                </span>
                                <el-switch
                                    v-model="state.forceUrlContextEnabled"
                                    :width="50"
                                    :before-change="handleForceUrlContextBeforeChange"
                                />
                            </div>
                            <div class="switch-container">
                                <span class="label">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        style="margin-right: 6px; vertical-align: middle"
                                    >
                                        <polyline points="16 18 22 12 16 6"></polyline>
                                        <polyline points="8 6 2 12 8 18"></polyline>
                                    </svg>
                                    {{ t("forceCodeExecution") }}
                                </span>
                                <el-switch
                                    v-model="state.forceCodeExecutionEnabled"
                                    :width="50"
                                    :before-change="handleForceCodeExecutionBeforeChange"
                                />
                            </div>
                            <div class="switch-container">
                                <span class="label">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        style="margin-right: 6px; vertical-align: middle"
                                    >
                                        <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z"></path>
                                        <path d="M9 12h6"></path>
                                    </svg>
                                    <span>
                                        {{ t("safetySettingsThreshold") }}
                                        <EnvVarTooltip env-var="SAFETY_SETTINGS_THRESHOLD" doc-section="other-config" />
                                    </span>
                                </span>
                                <el-select
                                    v-model="state.safetySettingsThreshold"
                                    style="width: 150px"
                                    @change="handleSafetySettingsThresholdChange"
                                >
                                    <el-option
                                        v-for="option in safetySettingsThresholdOptions"
                                        :key="option.value"
                                        :label="t(option.label)"
                                        :value="option.value"
                                    />
                                </el-select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- STATS VIEW -->
            <UsageStatsPanel v-if="activeTab === 'stats'" :records="statsState.records" :lang="state.currentLang" />

            <div v-if="activeTab === 'logs'" class="view-container logs-view-container">
                <header class="page-header" style="display: flex; justify-content: space-between; align-items: center">
                    <h1>{{ t("realtimeLogs") }} ({{ state.logCount }})</h1>
                    <button
                        class="btn-icon"
                        :title="t('downloadLogs')"
                        style="
                            padding: 8px;
                            border-radius: 8px;
                            background: var(--bg-card);
                            border: 1px solid var(--border-light);
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            color: var(--text-primary);
                        "
                        @click="downloadCurrentLogs"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span style="font-size: 0.9rem; font-weight: 500">{{ t("downloadLogs") }}</span>
                    </button>
                </header>
                <div class="status-card logs-card">
                    <pre id="log-container" v-html="formattedLogs"></pre>
                </div>
            </div>
        </main>
        <el-dialog v-model="modelDialog.visible" :title="state.currentLang === 'zh' ? `账号 #${modelDialog.index} 的模型目录` : `Models for account #${modelDialog.index}`" width="min(720px, 94vw)" class="model-catalog-dialog">
            <div class="model-catalog-summary">{{ state.currentLang === 'zh' ? `共 ${modelDialog.models.length} 个目录项` : `${modelDialog.models.length} catalog entries` }}<small>{{ state.currentLang === 'zh' ? '目录不代表已逐项验证可生成' : 'Catalog entries are not individually verified for generation' }}</small></div>
            <el-input v-model="modelDialog.query" clearable :placeholder="state.currentLang === 'zh' ? '搜索模型名称或 ID' : 'Search name or ID'" />
            <div class="model-catalog-list"><div v-for="model in filteredDialogModels" :key="model.id" class="model-catalog-row"><span class="model-catalog-name">{{ model.name || model.id }}</span><code>{{ model.id }}</code><span v-if="model.methods?.length" class="model-catalog-methods">{{ model.methods.join(' · ') }}</span></div><div v-if="!filteredDialogModels.length" class="model-catalog-empty">{{ state.currentLang === 'zh' ? '没有匹配的模型' : 'No matching models' }}</div></div>
            <template #footer><el-button @click="modelDialog.visible = false">{{ state.currentLang === 'zh' ? '关闭' : 'Close' }}</el-button></template>
        </el-dialog>

        <!-- Mobile Floating Action Buttons -->
        <el-affix
            :offset="90"
            position="bottom"
            class="mobile-only"
            style="position: fixed; right: 0; bottom: calc(90px + env(safe-area-inset-bottom, 0px)); z-index: 999"
        >
            <div class="floating-actions" :class="{ 'is-expanded': state.floatingActionsExpanded }">
                <button
                    class="floating-btn toggle-btn primary-btn"
                    :class="{ 'is-active': state.floatingActionsExpanded }"
                    :title="state.floatingActionsExpanded ? t('collapse') : t('expand')"
                    @click="state.floatingActionsExpanded = !state.floatingActionsExpanded"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
                <button class="floating-btn logout-button secondary-btn" :title="t('logout')" @click="handleLogout">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </button>
                <button
                    class="floating-btn lang-switcher secondary-btn"
                    :title="t('switchLanguage')"
                    @click="handleLanguageChange(state.currentLang === 'en' ? 'zh' : 'en')"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="m5 8 6 6"></path>
                        <path d="m4 14 6-6 2-3"></path>
                        <path d="M2 5h12"></path>
                        <path d="M7 2h1"></path>
                        <path d="m22 22-5-10-5 10"></path>
                        <path d="M14 18h6"></path>
                    </svg>
                </button>
            </div>
        </el-affix>
    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox, ElNotification } from "element-plus";
import JSZip from "jszip";
import escapeHtml from "../utils/escapeHtml";
import I18n from "../utils/i18n";
import { useTheme } from "../utils/useTheme";
import EnvVarTooltip from "../components/EnvVarTooltip.vue";
import UsageStatsPanel from "../components/UsageStatsPanel.vue";

const router = useRouter();
const fileInput = ref(null);
const activeTab = ref("home");

// Create reactive version counter
const langVersion = ref(0);

// Translation function that tracks language changes
const t = (key, options) => {
    langVersion.value; // Access to track changes
    return I18n.t(key, options);
};

const statsState = reactive({ records: [] });

const fetchUsageStats = async () => {
    const res = await fetch("/api/usage-stats");
    if (res.redirected) {
        window.location.href = res.url;
        return;
    }
    if (res.status === 401) {
        window.location.href = "/login";
        return;
    }
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    statsState.records = data.records || [];
};

const scheduleUpdate = () => {
    if (!isActive) return;
    const randomInterval = 4000 + Math.floor(Math.random() * 3000);
    updateTimer = setTimeout(async () => {
        await Promise.all([updateContent(), fetchUsageStats()]).catch(err => {
            console.error("Error fetching data:", err.message || err);
        });
        scheduleUpdate();
    }, randomInterval);
};

const getApiErrorMessage = data => {
    if (data?.message) {
        return t(data.message, data);
    }

    if (data?.error) {
        return typeof data.error === "string" ? data.error : data.error.message;
    }

    return t("unknownError");
};

const switchTab = tabName => {
    if (activeTab.value === "logs") {
        const logContainer = document.getElementById("log-container");
        if (logContainer) {
            state.logScrollTop = logContainer.scrollTop;
        }
    }

    activeTab.value = tabName;

    if (tabName === "logs") {
        nextTick(() => {
            const logContainer = document.getElementById("log-container");
            if (logContainer) {
                logContainer.scrollTop = state.logScrollTop || 0;
            }
        });
    }
};

const { theme, setTheme } = useTheme();

const state = reactive({
    accountDetails: [],
    benefitScan: { running: false, total: 0, completed: 0, currentIndex: null, error: null },
    accountLoadBalancerAccounts: [],
    accountLoadBalancerActiveRequests: 0,
    accountLoadBalancerLimit: 0,
    accountLoadBalancingEnabled: false,
    accountMaxConcurrentRequests: 1,
    accountsLastMinute: [],
    activeContextsCount: 0,
    activeRequests: 0,
    apiKeySource: "",
    browserConnected: false,
    checkUpdateEnabled: true,
    currentAuthIndex: -1,
    currentLang: I18n.getLang(),
    debugModeEnabled: false,
    enableAuthUpdateEnabled: true,
    failureCount: 0,
    floatingActionsExpanded: false,
    forceCodeExecutionEnabled: false,
    forceThinkingEnabled: false,
    forceUrlContextEnabled: false,
    forceWebSearchEnabled: false,
    hasUpdate: false,
    isSwitchingAccount: false,
    isSystemBusy: false,
    isUpdating: false,
    latestVersion: null,
    logCount: 0,
    logMaxCount: 100,
    logs: t("loading"),
    logScrollTop: 0,
    maxContexts: 1,
    maxRetries: 3,
    releaseUrl: null,
    requestsLastMinute: 0,
    safetySettingsThreshold: "OFF",
    selectedAccounts: new Set(), // Selected account indices
    serviceConnected: false,
    streamingModeReal: false,
    // theme: handled by useTheme
    usageCount: 0,
});

const safetySettingsThresholdOptions = [
    { label: "safetySettingsThreshold.OFF", value: "OFF" },
    {
        label: "safetySettingsThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED",
        value: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
    },
    { label: "safetySettingsThreshold.BLOCK_LOW_AND_ABOVE", value: "BLOCK_LOW_AND_ABOVE" },
    { label: "safetySettingsThreshold.BLOCK_MEDIUM_AND_ABOVE", value: "BLOCK_MEDIUM_AND_ABOVE" },
    { label: "safetySettingsThreshold.BLOCK_ONLY_HIGH", value: "BLOCK_ONLY_HIGH" },
    { label: "safetySettingsThreshold.BLOCK_NONE", value: "BLOCK_NONE" },
];

const browserConnectedClass = computed(() => {
    if (state.isSystemBusy) {
        return "status-warning";
    }
    return state.browserConnected ? "status-ok" : "status-error";
});

const browserConnectedText = computed(() => {
    if (state.isSystemBusy) {
        return t("connecting");
    }
    return state.browserConnected ? t("running") : t("disconnected");
});

// Total scanned accounts count
const totalScannedCount = computed(() => state.accountDetails.length);

// Deduped available accounts count (excluding duplicates and invalid)
const dedupedAvailableCount = computed(() => {
    return state.accountDetails.filter(acc => !acc.isDuplicate && !acc.isInvalid).length;
});

// Active contexts display (e.g., "1 / 3" or "1 / ∞")
const activeContextsDisplay = computed(() => {
    const active = state.activeContextsCount;
    const max = state.maxContexts;
    return max === 0 ? `${active} / ∞` : `${active} / ${max}`;
});

const isBusy = computed(() => state.isSwitchingAccount || state.isSystemBusy);

const formattedLogs = computed(() => {
    if (!state.logs) return "";
    // Escape HTML first to prevent XSS (though logs should be safe, better safe than sorry)
    let safeLogs = escapeHtml(state.logs);

    // Highlight [DEBUG], [WARN], and [ERROR] at the start of lines with inline styles
    safeLogs = safeLogs.replace(
        /(^|\r?\n)(\[DEBUG\])(?=\s)/g,
        '$1<span style="color: #3498db; font-weight: bold;">$2</span>'
    );
    safeLogs = safeLogs.replace(
        /(^|\r?\n)(\[WARN\])(?=\s)/g,
        '$1<span style="color: #f39c12; font-weight: bold;">$2</span>'
    );
    safeLogs = safeLogs.replace(
        /(^|\r?\n)(\[ERROR\])(?=\s)/g,
        '$1<span style="color: #e74c3c; font-weight: bold;">$2</span>'
    );

    return safeLogs;
});

// Computed properties for batch selection
const selectedCount = computed(() => state.selectedAccounts.size);
const hasSelection = computed(() => state.selectedAccounts.size > 0);
const isAllSelected = computed(() => {
    if (state.accountDetails.length === 0) return false;
    return state.accountDetails.every(acc => state.selectedAccounts.has(acc.index));
});
const isAccountSelected = index => state.selectedAccounts.has(index);

// Toggle selection for a single account
const toggleSelectAccount = index => {
    if (state.selectedAccounts.has(index)) {
        state.selectedAccounts.delete(index);
    } else {
        state.selectedAccounts.add(index);
    }
};

// Toggle selection for all accounts
const selectInvalidAuthAccounts = () => {
    state.selectedAccounts.clear();
    state.accountDetails.forEach(item => {
        if (item.accountIssue?.deletable) state.selectedAccounts.add(item.index);
    });
};

const toggleSelectAll = () => {
    if (isAllSelected.value) {
        state.selectedAccounts.clear();
    } else {
        state.accountDetails.forEach(acc => {
            state.selectedAccounts.add(acc.index);
        });
    }
};

// Clear selection
const clearSelection = () => {
    state.selectedAccounts.clear();
};

// Batch delete accounts
const batchDeleteAccounts = async () => {
    if (state.selectedAccounts.size === 0) {
        ElMessage.warning(t("noAccountSelected"));
        return;
    }

    const indices = Array.from(state.selectedAccounts);
    const count = indices.length;

    // Helper to perform batch delete
    const performBatchDelete = async (forceDelete = false) => {
        const notification = ElNotification({
            duration: 0,
            message: t("operationInProgress"),
            title: t("warningTitle"),
            type: "warning",
        });
        state.isSwitchingAccount = true;
        let shouldUpdate = true;
        try {
            const res = await fetch("/api/accounts/batch", {
                body: JSON.stringify({ force: forceDelete, indices }),
                headers: { "Content-Type": "application/json" },
                method: "DELETE",
            });
            const data = await res.json();

            if (res.status === 409 && data.requiresConfirmation) {
                shouldUpdate = false;
                state.isSwitchingAccount = false;
                ElMessageBox.confirm(t("warningDeleteCurrentAccount"), t("warningTitle"), {
                    cancelButtonText: t("cancel"),
                    confirmButtonText: t("ok"),
                    lockScroll: false,
                    type: "error",
                })
                    .then(() => performBatchDelete(true))
                    .catch(e => {
                        if (e !== "cancel") {
                            console.error(e);
                        }
                    });
                return;
            }

            if (res.status === 207) {
                // Handle partial success (Multi-Status) first, as res.ok is true for 2xx
                ElMessage.warning(
                    t("batchDeletePartial", {
                        failedCount: data.failedIndices?.length || 0,
                        successCount: data.successCount,
                    })
                );
                // Remove deleted items from selection
                data.successIndices?.forEach(idx => state.selectedAccounts.delete(idx));
            } else if (res.ok) {
                // Handle full success (200 OK)
                ElMessage.success(t("batchDeleteSuccess", { count: data.successCount }));
                clearSelection();
            } else {
                ElMessage.error(t(data.message, data));
            }
        } catch (err) {
            ElMessage.error(t("batchDeleteFailed", { error: err.message || err }));
        } finally {
            notification.close();
            if (shouldUpdate) {
                state.isSwitchingAccount = false;
                updateContent();
            }
        }
    };

    ElMessageBox.confirm(t("confirmBatchDelete", { count }), t("warningTitle"), {
        cancelButtonText: t("cancel"),
        confirmButtonText: t("ok"),
        lockScroll: false,
        type: "warning",
    })
        .then(() => performBatchDelete(false))
        .catch(e => {
            if (e !== "cancel") {
                console.error(e);
            }
        });
};

// Batch download accounts as ZIP
const batchDownloadAccounts = async () => {
    if (state.selectedAccounts.size === 0) {
        ElMessage.warning(t("noAccountSelected"));
        return;
    }

    const indices = Array.from(state.selectedAccounts);

    try {
        const res = await fetch("/api/accounts/batch/download", {
            body: JSON.stringify({ indices }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
        });

        if (!res.ok) {
            let errorKey = "batchDownloadFailed";
            let errorParams = { error: res.statusText || `HTTP ${res.status}` };

            try {
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const data = await res.json();
                    if (data.message) {
                        errorKey = data.message;
                        errorParams = data;
                    } else if (data.error) {
                        const errorDetail = typeof data.error === "string" ? data.error : data.error.message;
                        errorParams = { error: errorDetail };
                    }
                } else {
                    errorParams = { error: `HTTP Error ${res.status}: ${res.statusText}` };
                }
            } catch (e) {
                // Parsing failed, keep default errorParams
            }
            ElMessage.error(t(errorKey, errorParams));
            return;
        }

        // Get the blob and trigger download
        const blob = await res.blob();
        const contentDisposition = res.headers.get("Content-Disposition");
        let filename = "auth_batch.zip";
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^"]+)"?/);
            if (match) {
                filename = match[1];
            }
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Use actual file count from response header, fallback to indices length
        const actualCount = parseInt(res.headers.get("X-File-Count"), 10);
        const requestCount = indices.length;
        const failedCount = requestCount - (isNaN(actualCount) ? requestCount : actualCount);

        if (!isNaN(actualCount) && failedCount > 0) {
            ElMessage.warning(
                t("batchDownloadPartial", {
                    failedCount,
                    successCount: actualCount,
                })
            );
        } else {
            ElMessage.success(t("batchDownloadSuccess", { count: !isNaN(actualCount) ? actualCount : requestCount }));
        }
    } catch (err) {
        ElMessage.error(t("batchDownloadFailed", { error: err.message || err }));
    }
};

const currentAccountName = computed(() => {
    if (state.currentAuthIndex < 0) {
        return t("noActiveAccount");
    }
    const account = state.accountDetails.find(acc => acc.index === state.currentAuthIndex);
    return account ? getAccountDisplayName(account) : t("noActiveAccount");
});

const currentAccountNameClass = computed(() => {
    if (state.currentAuthIndex < 0) {
        return "status-error";
    }
    const account = state.accountDetails.find(acc => acc.index === state.currentAuthIndex);
    return account ? "" : "status-error";
});

const serviceConnectedClass = computed(() => (state.serviceConnected ? "status-ok" : "status-error"));

const serviceConnectedText = computed(() => (state.serviceConnected ? t("running") : t("disconnected")));

const apiKeySourceText = computed(() => {
    const key = state.apiKeySource ? state.apiKeySource.toLowerCase() : "";
    const translated = key ? t(key) : "";
    return translated === key ? state.apiKeySource : translated || state.apiKeySource;
});

const poolSettings = reactive({ paidActive: 3, paidStandby: 2, normalActive: 2, normalStandby: 3 });
const poolSaving = ref(false);
let poolSettingsLoaded = false;
const savePoolSettings = async () => {
    poolSaving.value = true;
    try {
        const r = await fetch("/api/settings/account-pools", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(poolSettings) });
        const data = await r.json(); if (!r.ok) throw new Error(data.error || "Save failed");
        Object.assign(poolSettings, data.settings); ElMessage.success(state.currentLang === "zh" ? "设置已保存，账号池正在调整" : "Settings saved; pool is adjusting");
    } catch (e) { ElMessage.error(e.message); } finally { poolSaving.value = false; }
};

const accountBenefitGroups = computed(() => {
    const accounts = state.accountDetails || [];
    const zh = state.currentLang === "zh";
    return [
        { key: "paid", label: zh ? "付费权益（可能为 Pro）" : "Paid benefit (may include Pro)", items: accounts.filter(a => a.benefitState === "ready-paid") },
        { key: "free", label: zh ? "普通" : "Standard", items: accounts.filter(a => a.benefitState !== "ready-paid") },
    ];
});

const benefitProgressPercent = computed(() => state.benefitScan.total ? Math.min(100, Math.round(state.benefitScan.completed * 100 / state.benefitScan.total)) : 0);
const modelDialog = reactive({ visible: false, index: null, models: [], query: "" });
const filteredDialogModels = computed(() => { const q = modelDialog.query.trim().toLowerCase(); return modelDialog.models.filter(m => !q || `${m.id} ${m.name}`.toLowerCase().includes(q)); });
const showBenefitProgress = ref(false);
let benefitHideTimer = null;
watch(() => state.benefitScan.running, running => {
    if (benefitHideTimer) { clearTimeout(benefitHideTimer); benefitHideTimer = null; }
    if (running) showBenefitProgress.value = true;
    else if (showBenefitProgress.value && !state.benefitScan.error) benefitHideTimer = setTimeout(() => { showBenefitProgress.value = false; }, 8000);
});
const modelCheckIndex = ref(null);
const handleAccountMenu = async (command, index) => {
    if (command === "download") return downloadAccountByIndex(index);
    if (command === "benefit") {
        try {
            const r = await fetch(`/api/accounts/${index}/benefit/check`, { method: "POST" });
            if (!r.ok) throw new Error("failed");
            ElMessage.success(state.currentLang === "zh" ? `账号 #${index} 已加入检测队列` : `Account #${index} queued`);
            await updateContent();
        } catch { ElMessage.error(state.currentLang === "zh" ? "加入检测队列失败" : "Could not queue check"); }
        return;
    }
    if (command !== "models") return;
    if (modelCheckIndex.value !== null) return ElMessage.warning(state.currentLang === "zh" ? "已有模型检测正在进行" : "A model check is already running");
    modelCheckIndex.value = index;
    const busy = ElMessage({ message: state.currentLang === "zh" ? `正在查询账号 #${index} 的模型目录…` : `Checking models for account #${index}…`, duration: 0 });
    try {
        const response = await fetch(`/api/accounts/${index}/models/check`, { method: "POST" });
        const data = await response.json();
        if (!response.ok) {
            if (data.error === "account_not_connected") throw new Error(state.currentLang === "zh" ? "该账号尚未登录，请先切换到该账号后再检测。" : "Account is not connected; switch to it first.");
            throw new Error(state.currentLang === "zh" ? `查询失败（${data.error || response.status}），请稍后重试。` : `Check failed (${data.error || response.status}).`);
        }
        modelDialog.index = index;
        modelDialog.models = data.models;
        modelDialog.query = "";
        modelDialog.visible = true;
    } catch (error) { if (error !== "confirm" && error !== "cancel" && error !== "close") ElMessage.error(error.message || "Model check failed"); }
    finally { busy.close(); modelCheckIndex.value = null; }
};

const benefitChecking = ref(false);
const checkBenefits = async () => {
    benefitChecking.value = true;
    try {
        const response = await fetch("/api/accounts/benefits/check", { method: "POST" });
        if (!response.ok) throw new Error("check failed");
        const data = await response.json();
        state.benefitScan = data;
        ElMessage.success(data.started ? (state.currentLang === "zh" ? "已开始后台检测" : "Background check started") : (state.currentLang === "zh" ? "检测正在进行中" : "Scan already running"));
        await updateContent();
    } catch { ElMessage.error(state.currentLang === "zh" ? "权益检测失败，请稍后重试" : "Benefit check failed"); }
    finally { benefitChecking.value = false; }
};

// App version from build-time injection
const appVersion = computed(() => {
    const version = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
    // Add 'v' prefix only if version starts with a number (e.g. 1.0.0 -> v1.0.0)
    if (/^\d/.test(version)) {
        return `v${version}`;
    }
    // Capitalize 'preview'
    if (version.startsWith("preview")) {
        return version.charAt(0).toUpperCase() + version.slice(1);
    }
    // Keep raw string for others (e.g. main, dev)
    return version;
});

const latestVersionFormatted = computed(() => {
    const v = state.latestVersion || (typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev");
    if (/^\d/.test(v)) {
        return `v${v}`;
    }
    return v;
});

// Get display name for account with i18n support
const getAccountDisplayName = account => {
    if (account.isInvalid) {
        return t("jsonFormatError");
    }
    const name = account.name || t("unnamedAccount");
    if (account.isDuplicate && account.canonicalIndex !== null && account.canonicalIndex !== undefined) {
        return `${name} (${t("duplicateAuthHint", { index: account.canonicalIndex })})`;
    }
    return name;
};

const addUser = () => {
    router.push("/auth");
};

// Delete account by index
const deleteAccountByIndex = async targetIndex => {
    if (targetIndex === null || targetIndex === undefined) {
        ElMessage.warning(t("noAccountSelected"));
        return;
    }

    const targetAccount = state.accountDetails.find(acc => acc.index === targetIndex);
    const accountSuffix = targetAccount ? ` (${getAccountDisplayName(targetAccount)})` : "";

    // Helper function to perform the actual deletion
    const performDelete = async (forceDelete = false) => {
        const notification = ElNotification({
            duration: 0,
            message: t("operationInProgress"),
            title: t("warningTitle"),
            type: "warning",
        });
        state.isSwitchingAccount = true;
        let shouldUpdate = true;
        try {
            const url = forceDelete ? `/api/accounts/${targetIndex}?force=true` : `/api/accounts/${targetIndex}`;
            const res = await fetch(url, {
                method: "DELETE",
            });
            const data = await res.json();

            if (res.status === 409 && data.requiresConfirmation) {
                shouldUpdate = false;
                state.isSwitchingAccount = false;
                ElMessageBox.confirm(t("warningDeleteCurrentAccount"), t("warningTitle"), {
                    cancelButtonText: t("cancel"),
                    confirmButtonText: t("ok"),
                    lockScroll: false,
                    type: "error",
                })
                    .then(() => performDelete(true))
                    .catch(e => {
                        if (e !== "cancel") {
                            console.error(e);
                        }
                    });
                return;
            }

            const message = t(data.message, data);
            if (res.ok) {
                ElMessage.success(message);
            } else {
                ElMessage.error(message);
            }
        } catch (err) {
            ElMessage.error(t("deleteFailed", { message: err.message || err }));
        } finally {
            notification.close();
            if (shouldUpdate) {
                state.isSwitchingAccount = false;
                updateContent();
            }
        }
    };

    ElMessageBox.confirm(`${t("confirmDelete")} #${targetIndex}${accountSuffix}?`, t("warningTitle"), {
        cancelButtonText: t("cancel"),
        confirmButtonText: t("ok"),
        lockScroll: false,
        type: "warning",
    })
        .then(() => performDelete(false))
        .catch(e => {
            if (e !== "cancel") {
                console.error(e);
            }
        });
};

const deduplicateAuth = () => {
    ElMessageBox.confirm(t("accountDedupConfirm"), t("warningTitle"), {
        cancelButtonText: t("cancel"),
        confirmButtonText: t("ok"),
        lockScroll: false,
        type: "warning",
    })
        .then(async () => {
            const notification = ElNotification({
                duration: 0,
                message: t("operationInProgress"),
                title: t("warningTitle"),
                type: "warning",
            });
            state.isSwitchingAccount = true;
            try {
                const res = await fetch("/api/accounts/deduplicate", { method: "POST" });
                const data = await res.json();

                const removedIndicesText = Array.isArray(data.removedIndices)
                    ? `[${data.removedIndices.join(", ")}]`
                    : "[]";
                const failedText = Array.isArray(data.failed) ? JSON.stringify(data.failed) : "";

                const message = t(data.message, {
                    ...data,
                    failed: failedText,
                    removedIndices: removedIndicesText,
                });

                if (res.ok) {
                    ElMessage.success(message);
                } else {
                    ElMessage.error(message);
                }
            } catch (err) {
                ElMessage.error(t("accountDedupFailed", { error: err.message || err }));
            } finally {
                state.isSwitchingAccount = false;
                notification.close();
                updateContent();
            }
        })
        .catch(e => {
            if (e !== "cancel") {
                console.error(e);
            }
        });
};

const handleForceThinkingBeforeChange = () => handleSettingChange("/api/settings/force-thinking", "forceThinking");

const handleForceUrlContextBeforeChange = () =>
    handleSettingChange("/api/settings/force-url-context", "forceUrlContext");

const handleForceCodeExecutionBeforeChange = () =>
    handleSettingChange("/api/settings/force-code-execution", "forceCodeExecution");

const handleForceWebSearchBeforeChange = () => handleSettingChange("/api/settings/force-web-search", "forceWebSearch");
const handleAccountLoadBalancingBeforeChange = () =>
    handleSettingChange("/api/settings/account-load-balancing", "accountLoadBalancing");
const handleCheckUpdateBeforeChange = () => handleSettingChange("/api/settings/check-update", "checkUpdate");
const handleEnableAuthUpdateBeforeChange = () =>
    handleSettingChange("/api/settings/enable-auth-update", "enableAuthUpdate");

// Handle change specifically for Select component which might trigger logic differently
const handleStatsDebugChange = val => {
    handleSettingChange("/api/settings/debug-mode", "logLevel").then(success => {
        if (!success) {
            // Revert if failed
            state.debugModeEnabled = !val;
        }
    });
};

const handleLogMaxCountChange = val => {
    if (!val) return;
    fetch("/api/settings/log-max-count", {
        body: JSON.stringify({ count: val }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
    })
        .then(res => res.json())
        .then(data => {
            if (data.message === "settingUpdateSuccess") {
                ElMessage.success(t(data.message, { setting: t("logMaxCount"), value: val }));
                updateContent();
            } else {
                ElMessage.error(t(data.message || "settingFailed", { message: data.error || "" }));
            }
        })
        .catch(err => {
            ElMessage.error(t("settingFailed", { message: err.message || err }));
        });
};

const handleSafetySettingsThresholdChange = async val => {
    if (!val) return;

    try {
        const res = await fetch("/api/settings/safety-settings-threshold", {
            body: JSON.stringify({ value: val }),
            headers: { "Content-Type": "application/json" },
            method: "PUT",
        });
        const data = await res.json();

        if (res.ok) {
            ElMessage.success(
                t(data.message, {
                    setting: t("safetySettingsThreshold"),
                    value: t(`safetySettingsThreshold.${val}`),
                })
            );
            updateContent();
        } else {
            ElMessage.error(t(data.message || "settingFailed", { message: data.error || "" }));
            updateContent();
        }
    } catch (err) {
        ElMessage.error(t("settingFailed", { message: err.message || err }));
        updateContent();
    }
};

const handleLanguageChange = lang => {
    I18n.setLang(lang);
    state.currentLang = lang;
    langVersion.value++;
    localStorage.setItem("language", lang);
};

const handleLogout = () => {
    ElMessageBox.confirm(t("logoutConfirm"), {
        cancelButtonText: t("cancel"),
        confirmButtonText: t("ok"),
        lockScroll: false,
        type: "warning",
    })
        .then(() => {
            fetch("/logout", {
                headers: { "Content-Type": "application/json" },
                method: "POST",
            })
                .then(res => res.json())
                .then(data => {
                    const message = t(data.message);
                    if (data.message === "logoutSuccess") {
                        ElMessage.success(message);
                        setTimeout(() => {
                            window.location.href = "/login";
                        }, 500);
                    } else {
                        ElMessage.error(message);
                    }
                })
                .catch(err => {
                    console.error("Logout error:", err);
                    ElMessage.error(t("logoutError"));
                });
        })
        .catch(() => {});
};

const handleSettingChange = async (apiUrl, settingName) => {
    if (state.isUpdating) {
        return false;
    }

    try {
        const res = await fetch(apiUrl, { method: "PUT" });
        const data = await res.json();
        if (res.ok) {
            const message = t(data.message, {
                setting: t(settingName),
                value: t(String(data.value)),
            });
            ElMessage.success(message);
            updateContent();
            return true;
        }
        const message = t(data.message, data);
        ElMessage.error(message);
        return false;
    } catch (err) {
        ElMessage.error(t("settingFailed", { message: err.message || err }));
        return false;
    }
};

const handleStreamingModeBeforeChange = async () => {
    if (state.isUpdating) {
        return false;
    }

    const newMode = !state.streamingModeReal ? "real" : "fake";

    try {
        const res = await fetch("/api/settings/streaming-mode", {
            body: JSON.stringify({ mode: newMode }),
            headers: { "Content-Type": "application/json" },
            method: "PUT",
        });
        const data = await res.json();
        if (res.ok) {
            const message = t(data.message, {
                setting: t("streamingMode"),
                value: t(data.value),
            });
            ElMessage.success(message);
            updateContent();
            return true;
        }
        const message = t(data.message, data);
        ElMessage.error(message);
        return false;
    } catch (err) {
        ElMessage.error(t("settingFailed", { message: err.message || err }));
        return false;
    }
};

// Switch account by index
const switchAccountByIndex = targetIndex => {
    if (state.currentAuthIndex === targetIndex) {
        ElMessage.warning(t("alreadyCurrentAccount"));
        return;
    }

    const targetAccount = state.accountDetails.find(acc => acc.index === targetIndex);
    const accountSuffix = targetAccount ? ` (${getAccountDisplayName(targetAccount)})` : "";

    const switchWarning = state.currentLang === "zh"
        ? "原当前账号会关闭；若有正在进行的请求，该请求会中断。"
        : "The previous current account will close; any request on it will be interrupted.";
    ElMessageBox.confirm(`${t("confirmSwitch")} #${targetIndex}${accountSuffix}? ${switchWarning}`, {
        cancelButtonText: t("cancel"),
        confirmButtonText: t("ok"),
        lockScroll: false,
        type: "warning",
    })
        .then(async () => {
            const notification = ElNotification({
                duration: 0,
                message: t("switchingAccountNotice"),
                title: t("warningTitle"),
                type: "warning",
            });
            state.isSwitchingAccount = true;
            try {
                const res = await fetch("/api/accounts/current", {
                    body: JSON.stringify({ targetIndex }),
                    headers: { "Content-Type": "application/json" },
                    method: "PUT",
                });
                const data = await res.json();
                const message = t(data.message, data);
                if (res.ok) {
                    ElMessage.success(message);
                } else {
                    ElMessage.error(message);
                }
            } catch (err) {
                ElMessage.error(t("settingFailed", { message: err.message || err }));
            } finally {
                state.isSwitchingAccount = false;
                notification.close();
                updateContent();
            }
        })
        .catch(e => {
            if (e !== "cancel") {
                console.error(e);
            }
        });
};

const copyText = async text => {
    try {
        await navigator.clipboard.writeText(text);
        ElMessage.success(t("copySuccess"));
    } catch (err) {
        ElMessage.error(t("copyFailed"));
        console.error("Failed to copy:", err);
    }
};

const copyAppVersion = () => copyText(appVersion.value);

const updateStatus = data => {
    state.serviceConnected = true;

    const isEnabled = val => {
        if (val === true) return true;
        if (val === 1) return true;
        if (String(val).toLowerCase() === "true") return true;
        return false;
    };

    state.isUpdating = true;
    state.checkUpdateEnabled = isEnabled(data.status.checkUpdate);
    state.streamingModeReal = data.status.streamingMode === "real";
    state.enableAuthUpdateEnabled = isEnabled(data.status.enableAuthUpdate);
    state.forceThinkingEnabled = isEnabled(data.status.forceThinking);
    state.forceCodeExecutionEnabled = isEnabled(data.status.forceCodeExecution);
    state.forceWebSearchEnabled = isEnabled(data.status.forceWebSearch);
    state.forceUrlContextEnabled = isEnabled(data.status.forceUrlContext);
    state.debugModeEnabled = isEnabled(data.status.debugMode);
    state.currentAuthIndex = data.status.currentAuthIndex;
    state.accountDetails = data.status.accountDetails || [];
    if (!poolSettingsLoaded && data.status.accountPools) { Object.assign(poolSettings, data.status.accountPools); poolSettingsLoaded = true; }
    state.benefitScan = data.status.benefitScan || { running: false, total: 0, completed: 0, currentIndex: null, error: null };
    state.accountLoadBalancingEnabled = isEnabled(data.status.accountLoadBalancing);
    state.accountMaxConcurrentRequests = data.status.accountMaxConcurrentRequests ?? 1;
    state.accountLoadBalancerActiveRequests = data.status.loadBalancer?.activeRequests || 0;
    state.accountLoadBalancerLimit = data.status.loadBalancer?.globalConcurrencyLimit || 0;
    state.accountLoadBalancerAccounts = data.status.loadBalancer?.accounts || [];
    state.activeRequests = data.status.recentLoad?.activeRequests || 0;
    state.accountsLastMinute = data.status.recentLoad?.accounts || [];
    state.requestsLastMinute = data.status.recentLoad?.requestsLastMinute || 0;
    state.activeContextsCount = data.status.activeContextsCount || 0;
    state.maxContexts = data.status.maxContexts ?? 1;
    state.maxRetries = data.status.maxRetries ?? 3;
    state.safetySettingsThreshold = data.status.safetySettingsThreshold || "OFF";

    const validIndices = new Set(state.accountDetails.map(acc => acc.index));
    for (const idx of state.selectedAccounts) {
        if (!validIndices.has(idx)) {
            state.selectedAccounts.delete(idx);
        }
    }
    state.browserConnected = data.status.browserConnected;
    state.apiKeySource = data.status.apiKeySource;
    state.usageCount = data.status.usageCount;
    state.failureCount = data.status.failureCount;
    state.logCount = data.logCount || 0;
    state.logMaxCount = data.status.logMaxCount || 100;
    state.logs = data.logs || "";
    state.isSystemBusy = data.status.isSystemBusy;

    nextTick(() => {
        state.isUpdating = false;
    });
};

let updateTimer = null;
let isActive = true;

const updateContent = async () => {
    const dot = document.querySelector(".dot");
    try {
        const res = await fetch("/api/status");
        if (res.redirected) {
            window.location.href = res.url;
            return;
        }
        if (res.status === 401) {
            window.location.href = "/login";
            return;
        }
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();

        if (dot) {
            if (state.serviceConnected) dot.classList.add("status-running");
            else dot.classList.remove("status-running");
        }
        updateStatus(data);
    } catch (err) {
        console.error("Error fetching status:", err.message || err);
        state.serviceConnected = false;
    }
};

const triggerFileUpload = () => {
    if (fileInput.value) {
        fileInput.value.click();
    }
};

const handleFileUpload = async event => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    // Reset input so same files can be selected again
    event.target.value = "";

    // Show notification immediately
    const notification = ElNotification({
        duration: 0,
        message: t("operationInProgress"),
        title: t("warningTitle"),
        type: "warning",
    });

    // Set busy flag to disable UI during upload and rebalance
    state.isSwitchingAccount = true;

    try {
        // Helper function to read file as ArrayBuffer (for zip)
        const readFileAsArrayBuffer = file =>
            new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = () => reject(new Error(t("fileReadFailed")));
                reader.readAsArrayBuffer(file);
            });

        // Helper function to read file as text (for json)
        const readFileAsText = file =>
            new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve({ content: e.target.result, name: file.name });
                reader.onerror = () => reject(new Error(t("fileReadFailed")));
                reader.readAsText(file);
            });

        // Helper function to upload a single file
        const uploadFile = async fileData => {
            let parsed;
            try {
                parsed = JSON.parse(fileData.content);
            } catch (err) {
                return { error: t("invalidJson"), filename: fileData.name, success: false };
            }

            try {
                const res = await fetch("/api/files", {
                    body: JSON.stringify({ content: parsed }),
                    headers: { "Content-Type": "application/json" },
                    method: "POST",
                });

                if (res.ok) {
                    const data = await res.json();
                    return { filename: data.filename || fileData.name, success: true };
                }

                let errorMsg;
                try {
                    const data = await res.json();
                    errorMsg = getApiErrorMessage(data);
                } catch (e) {
                    // Response is not JSON or cannot be parsed, fallback to status text or unknown error
                    if (res.statusText) {
                        errorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
                    } else {
                        errorMsg = `HTTP Error ${res.status}`;
                    }
                }
                return { error: errorMsg, filename: fileData.name, success: false };
            } catch (err) {
                // Network or other fetch errors
                return { error: err.message || t("networkError"), filename: fileData.name, success: false };
            }
        };

        // Collect all JSON files to upload (including extracted from zip)
        const jsonFilesToUpload = [];
        const extractErrors = [];

        for (const file of files) {
            const lowerName = file.name.toLowerCase();

            if (lowerName.endsWith(".zip")) {
                // Extract JSON files from zip
                try {
                    let arrayBuffer;
                    try {
                        arrayBuffer = await readFileAsArrayBuffer(file);
                    } catch (readErr) {
                        extractErrors.push({ local: file.name, reason: readErr.message || t("fileReadFailed") });
                        continue; // Skip zip processing if read failed
                    }

                    const zip = await JSZip.loadAsync(arrayBuffer);
                    const zipEntries = Object.keys(zip.files);

                    let foundJsonInZip = false;
                    for (const entryName of zipEntries) {
                        const entry = zip.files[entryName];
                        // Skip directories and non-json files
                        if (entry.dir || !entryName.toLowerCase().endsWith(".json")) continue;

                        foundJsonInZip = true;
                        try {
                            const content = await entry.async("string");
                            // Use format: zipName/entryName for display
                            const displayName = `${file.name}/${entryName}`;
                            jsonFilesToUpload.push({ content, name: displayName });
                        } catch (err) {
                            extractErrors.push({
                                local: `${file.name}/${entryName}`,
                                reason: t("zipExtractFailed"), // Prefer localized generic error for extraction issues
                            });
                        }
                    }

                    if (!foundJsonInZip) {
                        extractErrors.push({ local: file.name, reason: t("zipNoJsonFiles") });
                    }
                } catch (err) {
                    // Catch any other errors during zip processing (e.g. invalid zip format)
                    extractErrors.push({ local: file.name, reason: t("zipExtractFailed") });
                }
            } else if (lowerName.endsWith(".json")) {
                // Regular JSON file
                try {
                    const fileData = await readFileAsText(file);
                    jsonFilesToUpload.push(fileData);
                } catch (err) {
                    extractErrors.push({ local: file.name, reason: err.message || t("fileReadFailed") });
                }
            }
        }

        // Check if we have anything to process
        if (jsonFilesToUpload.length === 0 && extractErrors.length === 0) {
            ElMessage.warning(t("noSupportedFiles"));
            return;
        }

        // Upload all collected JSON files
        const successFiles = [];
        const failedFiles = [...extractErrors];

        // Use batch upload API if multiple files, otherwise use single file upload
        if (jsonFilesToUpload.length > 1) {
            // Batch upload
            const parsedFiles = [];
            const parseErrors = [];

            // Parse all files first
            for (const fileData of jsonFilesToUpload) {
                try {
                    const parsed = JSON.parse(fileData.content);
                    parsedFiles.push({ content: parsed, name: fileData.name });
                } catch (err) {
                    parseErrors.push({ local: fileData.name, reason: t("invalidJson") });
                }
            }

            failedFiles.push(...parseErrors);

            // Upload all valid files in one batch
            if (parsedFiles.length > 0) {
                try {
                    const res = await fetch("/api/files/batch", {
                        body: JSON.stringify({ files: parsedFiles.map(f => f.content) }),
                        headers: { "Content-Type": "application/json" },
                        method: "POST",
                    });

                    if (res.ok || res.status === 207) {
                        const data = await res.json();
                        // Process results array with proper index mapping
                        if (data.results && Array.isArray(data.results)) {
                            for (const result of data.results) {
                                const originalFile = parsedFiles[result.index];
                                if (result.success) {
                                    successFiles.push({
                                        local: originalFile?.name || `file-${result.index}`,
                                        saved: result.filename || originalFile?.name || `file-${result.index}`,
                                    });
                                } else {
                                    failedFiles.push({
                                        local: originalFile?.name || `file-${result.index}`,
                                        reason: result.error || t("unknownError"),
                                    });
                                }
                            }
                        }
                    } else {
                        // Batch upload failed completely
                        let errorMsg;
                        try {
                            const data = await res.json();
                            errorMsg = getApiErrorMessage(data);
                        } catch (e) {
                            if (res.statusText) {
                                errorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
                            } else {
                                errorMsg = `HTTP Error ${res.status}`;
                            }
                        }
                        // Mark all parsed files as failed
                        for (const fileData of parsedFiles) {
                            failedFiles.push({ local: fileData.name, reason: errorMsg });
                        }
                    }
                } catch (error) {
                    // Network or other error - mark all parsed files as failed
                    // (parseErrors are already in failedFiles)
                    for (const fileData of parsedFiles) {
                        failedFiles.push({ local: fileData.name, reason: error.message || t("networkError") });
                    }
                }
            }
        } else {
            // Single file upload (use existing logic)
            for (const fileData of jsonFilesToUpload) {
                const result = await uploadFile(fileData);
                if (result.success) {
                    successFiles.push({ local: fileData.name, saved: result.filename });
                } else {
                    failedFiles.push({ local: fileData.name, reason: result.error });
                }
            }
        }

        // Build notification message with file details (scrollable container)
        let messageHtml = '<div style="max-height: 50vh; overflow-y: auto;">';

        if (successFiles.length > 0) {
            messageHtml += `<div style="margin-bottom: 8px;"><strong style="color: var(--el-color-success);">${t("fileUploadBatchSuccess")} (${successFiles.length}):</strong></div>`;
            messageHtml += '<ul style="margin: 0 0 12px 16px; padding: 0;">';
            for (const f of successFiles) {
                messageHtml += `<li style="word-break: break-all;">${escapeHtml(f.local)} → ${escapeHtml(f.saved)}</li>`;
            }
            messageHtml += "</ul>";
        }

        if (failedFiles.length > 0) {
            messageHtml += `<div style="margin-bottom: 8px;"><strong style="color: var(--el-color-danger);">${t("fileUploadBatchFailed")} (${failedFiles.length}):</strong></div>`;
            messageHtml += '<ul style="margin: 0 0 0 16px; padding: 0;">';
            for (const f of failedFiles) {
                messageHtml += `<li style="word-break: break-all;">${escapeHtml(f.local)}: ${escapeHtml(f.reason)}</li>`;
            }
            messageHtml += "</ul>";
        }

        messageHtml += "</div>";

        // Determine notification type
        let notifyType = "success";
        if (failedFiles.length > 0 && successFiles.length === 0) {
            notifyType = "error";
        } else if (failedFiles.length > 0) {
            notifyType = "warning";
        }

        // Build title with counts
        const totalProcessed = successFiles.length + failedFiles.length;
        let notifyTitle;
        if (totalProcessed === 1) {
            notifyTitle = t("fileUploadComplete");
        } else {
            notifyTitle = `${t("fileUploadBatchResult")} (✓${successFiles.length} ✗${failedFiles.length})`;
        }

        // Show result notification (keep open)
        ElNotification({
            dangerouslyUseHTMLString: true,
            duration: 0,
            message: messageHtml,
            position: "top-right",
            title: notifyTitle,
            type: notifyType,
        });

        updateContent();
    } finally {
        // Always close notification and reset busy flag
        notification.close();
        state.isSwitchingAccount = false;
    }
};

// Download account by index
const downloadAccountByIndex = accountIndex => {
    if (accountIndex === null || accountIndex === undefined) return;
    window.location.href = `/api/files/auth-${accountIndex}.json`;
};

const formatDownloadTimestamp = () => {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, "0");
    const DD = String(now.getDate()).padStart(2, "0");
    const HH = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");

    return `${YYYY}-${MM}-${DD}_${HH}${mm}${ss}`;
};

// Download current logs
const downloadCurrentLogs = () => {
    if (!state.logs) return;

    const blob = new Blob([state.logs], { type: "text/plain" });
    const filename = `AIStudioToAPI_${formatDownloadTimestamp()}_${state.logCount}.log`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Theme handling is now managed by useTheme composable

onMounted(() => {
    // Listen for language changes
    I18n.onChange(() => {
        langVersion.value++;
        if (state.logCount === 0) {
            state.logs = t("loading");
        }
    });

    Promise.all([updateContent(), fetchUsageStats()]).finally(scheduleUpdate);

    // Expose copyText function globally for tooltip HTML content
    window.__copyEnvVar = text => copyText(text);
});

onBeforeUnmount(() => {
    if (benefitHideTimer) clearTimeout(benefitHideTimer);
    isActive = false;
    if (updateTimer) {
        clearTimeout(updateTimer);
    }
    // Clean up global function
    delete window.__copyEnvVar;
});

watchEffect(() => {
    document.title = t("statusTitle");
});
</script>

<style lang="less" scoped>
@import "../styles/variables.less";

.recent-load-card {
    .status-item-column {
        align-items: flex-start;
        flex-direction: column;
        gap: 0.6rem;
    }

    .recent-account-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
    }

    .recent-account-chip {
        background: rgba(var(--color-primary-rgb), 0.12);
        border: 1px solid rgba(var(--color-primary-rgb), 0.25);
        border-radius: 999px;
        color: var(--text-primary);
        font-size: 0.85rem;
        padding: 0.25rem 0.55rem;
    }

    .muted-text {
        color: var(--text-secondary);
    }
}

.main-layout {
    display: flex;
    min-height: 100vh;
    background-color: @background-light;
}

/* Sidebar Styling */
.sidebar {
    width: 60px;
    background: @background-white;
    border-right: 1px solid @border-light;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 20px 0;
    align-items: center;
    position: fixed;
    height: 100vh;
    z-index: 100;
}

.sidebar-menu,
.sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 15px;
    align-items: center;
}

.menu-item {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: @text-secondary;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    background: transparent;

    &:hover {
        background-color: @background-light;
        color: @primary-color;
    }

    &.active {
        background-color: @primary-color;
        color: @text-on-primary;
        box-shadow: 0 4px 12px rgba(var(--color-primary-rgb), 0.3);
    }

    &.logout-button:hover {
        color: @error-color;
        background-color: rgba(var(--color-error-rgb), 0.1);
    }
}

/* Content Area */
.content-area {
    flex: 1;
    margin-left: 60px; /* Sidebar width */
    padding: 2rem;
    max-width: none;
    min-width: 0;
}

.page-header {
    margin-bottom: 2rem;

    h1 {
        font-size: 1.5rem;
        font-weight: 600;
        color: @text-primary;
        display: flex;
        align-items: center;
        gap: 10px;
    }
}

.view-container {
    animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.account-benefit-group { margin-top: 18px; }
.account-group-title { display: flex; align-items: center; gap: 8px; font-size: 14px; margin: 0 0 8px; }
.account-group-title span { font-size: 12px; border-radius: 10px; padding: 1px 8px; background: var(--el-fill-color-light); color: var(--el-text-color-secondary); }
.account-group-title.group-paid { color: #16a34a; }
.account-group-title.group-free { color: #d97706; }
.account-group-title.group-unknown, .account-group-hint { color: var(--el-text-color-secondary); }
.account-group-hint { font-size: 12px; margin: 0 0 8px; }
.pool-settings-hint { color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.6; }
.pool-settings-grid { display: grid; grid-template-columns: auto 1fr 1fr; gap: 12px; align-items: center; margin: 15px 0; }
.pool-settings-grid label { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; }
@media (max-width: 600px) { .pool-settings-grid { grid-template-columns: 1fr 1fr; } .pool-settings-grid strong { grid-column: 1 / -1; } }
.model-catalog-summary { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline; font-weight: 600; margin-bottom: 12px; }
.model-catalog-summary small { color: var(--el-text-color-secondary); font-weight: 400; }
.model-catalog-list { max-height: min(55vh, 480px); overflow: auto; margin-top: 12px; border: 1px solid var(--el-border-color-light); border-radius: 10px; }
.model-catalog-row { display: grid; gap: 4px; padding: 10px 14px; border-bottom: 1px solid var(--el-border-color-lighter); }
.model-catalog-row:last-child { border-bottom: 0; }
.model-catalog-row code { color: var(--el-color-primary); overflow-wrap: anywhere; }
.model-catalog-name { font-weight: 600; overflow-wrap: anywhere; }
.model-catalog-methods, .model-catalog-empty { font-size: 12px; color: var(--el-text-color-secondary); }
.model-catalog-empty { padding: 20px; text-align: center; }
.benefit-scan-panel { border: 1px solid var(--el-border-color-lighter); border-radius: 10px; padding: 12px 14px; margin: 12px 0; background: var(--el-fill-color-blank); }
.benefit-progress { margin-top: 12px; max-width: 620px; }
.benefit-progress-heading { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
.benefit-progress-caption { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 6px; }
.standby-badge { color: #b45309; background: rgba(245,158,11,.13); border-radius: 10px; padding: 2px 8px; font-size: 12px; margin-left: 6px; }
.benefit-toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 12px 0; }
.benefit-toolbar small { color: var(--el-text-color-secondary); }
.benefit-paid, .benefit-free, .benefit-unknown { font-size: 12px; margin-left: 6px; }
.benefit-paid { color: #16a34a; } .benefit-free { color: #d97706; } .benefit-unknown { color: #888; }

/* Compact dashboard overview */
.overview-grid { width: 100%; }
.overview-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 12px; }
.overview-metric { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; min-width: 0; }
.overview-metric .label { color: var(--el-text-color-secondary); font-size: 13px; }
.overview-metric strong { font-size: 16px; }
.overview-active { color: #16a34a; }
.overview-standby { color: #d97706; }
.version-note { color: var(--el-text-color-secondary); font-size: 12px; margin-top: 10px; }

/* Dashboard Grid */
.dashboard-grid {
    display: grid;
    gap: 24px;
    width: 100%;
}

/* Responsive Grid Columns */
@media (max-width: 599px) {
    .dashboard-grid {
        grid-template-columns: 1fr;
    }
}

@media (min-width: 600px) and (max-width: 1023px) {
    .dashboard-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (min-width: 1024px) {
    .dashboard-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

/* Full Width Section for Account Management */
.full-width-section {
    margin-top: 24px;
    width: 100%;
}

/* Common Card Styles */
.status-card {
    background: @background-white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: @shadow-light;
    border: 1px solid @border-light;
    min-width: 0;
}

.card-title {
    font-size: 0.9rem;
    color: @text-secondary;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
    margin-bottom: 20px;
    border-bottom: 1px solid @border-light;
    padding-bottom: 15px;
}

/* Status Items */
.status-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.95rem;
    min-height: 32px; /* Ensure uniform height even with components */
}

.label {
    color: @text-secondary;
    display: inline-flex;
    align-items: center;

    svg {
        flex-shrink: 0;
        transform: translateY(1px);
    }
}

.value {
    font-weight: 500;
    color: @text-primary;
    font-family: @font-family-mono;
}

.status-text-bold {
    font-weight: 700 !important;
    opacity: 1 !important;
}

.account-value {
    display: flex;
    justify-content: flex-end;
    align-items: flex-start; /* Align to top for multiline names */
    gap: 6px;
    min-width: 0;
    max-width: 100%;
    text-align: right;
}

.account-idx-display {
    white-space: nowrap;
}

.account-name {
    max-width: 450px;
    word-break: break-word;
    white-space: normal;
    min-width: 0;
    text-align: right;
}

@media (min-width: 600px) {
    .account-name {
        max-width: 450px;
    }
}

@media (min-width: 1024px) {
    .account-name {
        max-width: none;
    }
}

.status-ok {
    color: @success-color;
}
.status-warning {
    color: @warning-color;
}
.status-error {
    color: @error-color;
}

.dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: @border-color;

    &.status-running {
        background-color: @success-color;
        box-shadow: 0 0 8px @success-color;
    }

    &.status-error {
        background-color: @error-color;
    }
}

.clickable-version {
    cursor: pointer;
    transition: color 0.3s;
    display: inline-flex;
    align-items: center;

    &:hover {
        color: @primary-color;
    }
}

/* Account List */
.account-list-container {
    margin: 15px 0;
    background: @background-light;
    border-radius: 8px;
    padding: 10px;
    max-height: 150px;
    overflow-y: auto;
}

.account-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 0.9rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);

    &:last-child {
        border-bottom: none;
    }
}

.account-idx {
    color: @text-secondary;
    font-family: @font-family-mono;
}

/* Settings View Specifics */
.settings-card {
    max-width: 600px;
    margin: 0 auto;
}

.action-group {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    margin-bottom: 30px;
    align-items: center;
}

.icon-buttons {
    display: flex;
    gap: 10px;

    button {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid @border-color;
        border-radius: 8px;
        background: @background-white;
        color: @text-secondary;
        cursor: pointer;
        transition: all 0.2s;

        &:hover:not(:disabled) {
            border-color: @primary-color;
            color: @primary-color;
        }

        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        &.btn-danger:hover:not(:disabled) {
            border-color: @error-color;
            color: @error-color;
        }

        &.btn-warning:hover:not(:disabled) {
            border-color: @warning-color;
            color: @warning-color;
        }
    }
}

/* Account list styles */
.account-top-actions {
    margin-bottom: 16px;
    justify-content: space-between;
}

.batch-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    min-height: 36px;
    height: auto;
    min-width: 0;
    max-width: 100%;

    .el-checkbox {
        height: 36px;
        margin-right: 0;
        display: flex;
        align-items: center;
    }
}

.selected-count {
    font-size: 0.85rem;
    color: @primary-color;
    font-weight: 500;
    display: flex;
    align-items: center;
    height: 36px;
}

.btn-batch-delete {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid @border-color;
    border-radius: 8px;
    background: @background-white;
    color: @text-secondary;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
        border-color: @error-color;
        color: @error-color;
        background: transparent;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
}

.btn-batch-download {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid @border-color;
    border-radius: 8px;
    background: @background-white;
    color: @text-secondary;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
        border-color: @primary-color;
        color: @primary-color;
        background: transparent;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
}

.account-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 400px;
    overflow-y: auto;
}

.account-list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: @background-light;
    border-radius: 8px;
    border: 1px solid transparent;
    transition: all 0.2s;

    &:hover {
        background: var(--bg-list-item-hover);
    }

    &.is-current {
        border-color: @success-color;
        background: rgba(var(--color-success-rgb), 0.25);
    }

    &.is-selected {
        background: rgba(var(--color-primary-rgb), 0.25); // Darker blue background for selected
    }

    &.is-current.is-selected {
        background: rgba(var(--color-primary-rgb), 0.25); // Use blue background like selected
        border: 1px solid @success-color;
    }
}

.account-checkbox {
    flex-shrink: 0;
    margin-right: 8px;
}

.account-info {
    display: flex;
    align-items: center;
    gap: 5px;
    flex: 1;
    min-width: 0;
}

.account-index {
    font-family: @font-family-mono;
    font-size: 0.85rem;
    color: @text-secondary;
    flex-shrink: 0;
}

.account-email {
    font-size: 0.9rem;
    color: @text-primary;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;

    &.is-error {
        color: @error-color;
    }

    &.is-duplicate {
        color: @warning-color;
    }
}

.current-badge {
    font-size: 0.75rem;
    padding: 2px 8px;
    background: @success-color;
    color: @text-on-primary;
    border-radius: 12px;
    flex-shrink: 0;
    margin-left: 0;
    margin-right: 6px;
}

.expired-badge {
    font-size: 0.75rem;
    padding: 2px 8px;
    background: @error-color;
    color: @text-on-primary;
    border-radius: 12px;
    flex-shrink: 0;
    margin-left: 0;
    margin-right: 6px;
}

.account-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;

    button {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid @border-color;
        border-radius: 6px;
        background: @background-white;
        color: @text-secondary;
        cursor: pointer;
        transition: all 0.2s;

        &:hover:not(:disabled) {
            border-color: @primary-color;
            color: @primary-color;
        }

        &.btn-switch:hover:not(:disabled) {
            border-color: @success-color;
            color: @success-color;
        }

        &.btn-switch.is-active {
            background-color: @background-white;
            border-color: @success-color;
            color: @success-color;
            opacity: 1 !important;
            cursor: not-allowed;
        }

        &.btn-switch.is-callable {
            color: @success-color;
            border-color: @success-color;
        }

        &.btn-switch.is-fast {
            color: #f59e0b;
            border-color: #fcd34d;
        }

        &.btn-switch.is-fast:hover:not(:disabled) {
            border-color: @success-color;
            color: @success-color;
            background-color: @background-white;
        }

        &:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        &.btn-danger:hover:not(:disabled) {
            border-color: @error-color;
            color: @error-color;
        }
    }
}

.account-list-empty {
    padding: 24px;
    text-align: center;
    color: @text-secondary;
    font-size: 0.9rem;
}

.settings-switches {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.switch-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.95rem;
    min-height: 32px;
}

/* Logs View Specifics */
.logs-view-container {
    /* Full height minus content-area padding (2rem top + 2rem bottom) */
    height: calc(100vh - 4rem);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.logs-view-container .page-header {
    flex-shrink: 0;
    /* Ensure header doesn't take extra margins causing overflow */
    margin-bottom: 20px;
}

.logs-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden; /* Contain scroll */
    min-height: 0; /* Allow flex child to shrink below content size */
    padding: 0;
    margin-bottom: 0;
}

#log-container {
    flex: 1;
    overflow-y: auto; /* Internal scrollbar */
    padding: 20px;
    margin: 0;
    background: @background-white;
    color: @text-primary;
    font-family: @font-family-mono;
    font-size: 0.85rem;
    line-height: 1.5;
    border-radius: 0 0 16px 16px;
    white-space: pre-wrap;
    word-break: break-all;
    max-width: 100%;
    width: 100%;
}

.version-footer {
    margin-top: 30px;
    display: flex;
    gap: 15px;
    justify-content: center;
    align-items: center;
    font-size: 0.9rem;
    color: @text-secondary;
}

.github-link {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: #24292f;
    color: #fff !important;
    padding: 6px 16px;
    border-radius: 20px;
    font-weight: 600;
    transition: all 0.2s;

    &:hover {
        background-color: #333;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
}

.version-tag {
    background-color: #0366d6;
    color: #fff;
    padding: 6px 12px;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.9rem;
}

.update-tag {
    color: @error-color !important;
    font-weight: 600;
    font-size: 0.9rem;
}

.repo-link {
    color: @primary-color;
    text-decoration: none;
    font-weight: 500;
}

.repo-link:hover {
    text-decoration: underline;
}

.update-link {
    color: @error-color;
    text-decoration: none;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
    animation: red-white-breath 2s infinite ease-in-out;

    &:hover {
        animation: none;
        color: @error-color;
        opacity: 1;
    }
}

@keyframes red-white-breath {
    0%,
    100% {
        color: @error-color;
    }
    50% {
        color: rgba(var(--color-error-rgb), 0.5);
    }
}

// Mobile floating action buttons
.mobile-only {
    display: block;
}

.floating-actions {
    align-items: flex-end;
    display: flex;
    flex-direction: column-reverse; /* Put toggle button at bottom */
    gap: 12px;
    transition: all @transition-normal;

    &:not(.is-expanded) {
        opacity: 0.5;
        transform: translateX(15px); /* Peek from the edge */

        &:hover {
            opacity: 1;
            transform: translateX(0);
        }
    }

    &.is-expanded {
        opacity: 1;
        transform: translateX(-30px);
    }
}

.floating-btn {
    align-items: center;
    backdrop-filter: blur(10px);
    background: @affix-button-bg;
    border: 1px solid @affix-button-border;
    border-radius: @border-radius-circle 0 0 @border-radius-circle; /* Rounded left side only when stuck */
    box-shadow: @affix-button-shadow;
    cursor: pointer;
    display: flex;
    height: @affix-button-size;
    justify-content: center;
    transition: all @transition-normal;
    width: @affix-button-size;
    position: relative;
    z-index: 1;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }

    svg {
        display: block;
        width: 24px;
        height: 24px;
        transition: transform @transition-normal;
    }

    &.secondary-btn {
        opacity: 0;
        transform: translateY(20px) scale(0.5);
        pointer-events: none;
        visibility: hidden;
        border-radius: @border-radius-circle; /* Secondary buttons remain round */
    }

    &.lang-switcher {
        color: @text-secondary;

        &:hover:not(:disabled) {
            background: @primary-color;
            box-shadow: @affix-button-hover-shadow;
            color: @background-white;
            transform: scale(1.05);
        }
    }

    &.logout-button {
        color: @text-secondary;

        &:hover:not(:disabled) {
            background: @error-color;
            box-shadow: @affix-button-hover-shadow;
            color: @background-white;
            transform: scale(1.05);
        }
    }

    &.toggle-btn {
        color: @text-secondary;
        z-index: 2;

        &:hover:not(:disabled) {
            background: @background-white;
            color: @primary-color;
        }

        &.is-active {
            background: @primary-color;
            color: @text-on-primary;
            border-radius: @border-radius-circle; /* Become round when expanded */

            svg {
                transform: rotate(45deg);
            }
        }
    }
}

.floating-actions.is-expanded {
    .secondary-btn {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
        visibility: visible;
    }
}

/* Mobile Adaptation */
@media (max-width: 768px) {
    .sidebar {
        width: 100%;
        height: 60px;
        bottom: 0;
        top: auto;
        flex-direction: row;
        border-right: none;
        border-top: 1px solid @border-light;
        padding: 0 20px;
    }

    .sidebar-menu {
        flex-direction: row;
        width: 100%;
        justify-content: space-around;
    }

    .sidebar-footer {
        display: none;
    }

    .content-area {
        margin-left: 0;
        padding: 16px;
        padding-bottom: 90px;
    }

    /* Mobile adaptation for logs view is now handled by the general flex layout,
       but we can adjust padding if needed */
    .logs-view-container {
        /* On mobile, content margin might be different.
           If sidebar changes to top nav, height calc might need adjustment.
           For now assuming similar layout logic or letting it fall back.
        */
        height: calc(100vh - 106px); /* Keeping the old logic for mobile specific height if needed */
    }
}

// Media query: Desktop (>=768px)
@media (min-width: 768px) {
    .mobile-only {
        display: none !important;
    }
}

.clickable-version,
.version-align {
    display: inline-flex;
    align-items: center;
    gap: 0;
}

.clickable-version {
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
        color: @primary-color;

        .copy-icon {
            opacity: 1;
        }
    }
}

.copy-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 4px;
}
.account-health-issue {
    display: block;
    max-width: 460px;
    white-space: normal;
    overflow-wrap: anywhere;
    font-size: 12px;
    color: #b45309;
}
.account-health-issue.is-permanent { color: #dc2626; }

/* Text action: independent of square icon buttons; never shrink into vertical text. */
.btn-select-invalid {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: auto;
    min-height: 36px;
    padding: 8px 12px;
    box-sizing: border-box;
    border: 1px solid @border-color;
    border-radius: 8px;
    background: @background-white;
    color: @text-secondary;
    white-space: nowrap;
    font: inherit;
    font-size: 13px;
    line-height: 20px;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;

    &:hover:not(:disabled), &:focus-visible {
        border-color: @primary-color;
        color: @primary-color;
    }
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
}
.account-top-actions > .icon-buttons { flex: 0 0 auto; }

</style>
