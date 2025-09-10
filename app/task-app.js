/**
 * Task App - 任务应用
 * 基于shop-app.js的模式，为mobile-phone.js提供任务功能
 */

// @ts-nocheck
// 避免重复定义
if (typeof window.TaskApp === 'undefined') {
  class TaskApp {
    constructor() {
      this.currentView = 'taskList'; // 'taskList', 'inProgress', 'completed'
      this.tasks = [];
      this.acceptedTasks = [];
      this.completedTasks = [];
      this.contextMonitor = null;
      this.lastTaskCount = 0;
      this.isAutoRenderEnabled = true;
      this.lastRenderTime = 0;
      this.renderCooldown = 1000;
      this.eventListenersSetup = false;
      this.contextCheckInterval = null;

      this.init();
    }

    init() {
      console.log('[Task App] 任务应用初始化开始 - 版本 2.0');

      // 立即解析一次任务信息
      this.parseTasksFromContext();

      // 异步初始化监控，避免阻塞界面渲染
      setTimeout(() => {
        this.setupContextMonitor();
      }, 100);

      console.log('[Task App] 任务应用初始化完成 - 版本 2.0');
    }

    // 设置上下文监控
    setupContextMonitor() {
      console.log('[Task App] 设置上下文监控...');

      // 监听上下文变化事件
      if (window.addEventListener) {
        window.addEventListener('contextUpdate', event => {
          this.handleContextChange(event);
        });

        // 监听消息更新事件
        window.addEventListener('messageUpdate', event => {
          this.handleContextChange(event);
        });

        // 监听聊天变化事件
        window.addEventListener('chatChanged', event => {
          this.handleContextChange(event);
        });

        // 监听DOM变化，检测新消息
        this.setupDOMObserver();
      }

      // 增加定时检查频率，从10秒改为3秒
      this.contextCheckInterval = setInterval(() => {
        this.checkContextChanges();
      }, 5000);

      // 监听SillyTavern的事件系统
      this.setupSillyTavernEventListeners();
    }

    // 设置DOM观察器
    setupDOMObserver() {
      try {
        // 观察聊天容器的变化
        const chatContainer =
          document.querySelector('#chat') || document.querySelector('.mes') || document.querySelector('[data-mes]');
        if (chatContainer) {
          const observer = new MutationObserver(mutations => {
            let shouldUpdate = false;
            mutations.forEach(mutation => {
              if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // 检查是否添加了新的消息节点
                mutation.addedNodes.forEach(node => {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.classList && (node.classList.contains('mes') || node.classList.contains('message'))) {
                      shouldUpdate = true;
                    }
                  }
                });
              }
            });

            if (shouldUpdate) {
              console.log('[Task App] 检测到新消息，更新任务状态');
              setTimeout(() => {
                this.parseTasksFromContext();
              }, 500);
            }
          });

          observer.observe(chatContainer, {
            childList: true,
            subtree: true,
          });

          console.log('[Task App] DOM观察器设置成功');
        }
      } catch (error) {
        console.warn('[Task App] 设置DOM观察器失败:', error);
      }
    }

    // 处理上下文变化
    handleContextChange(event) {
      console.log('[Task App] 上下文变化:', event);
      this.parseTasksFromContext();
    }

    // 检查上下文变化
    checkContextChanges() {
      if (!this.isAutoRenderEnabled) return;

      const currentTime = Date.now();
      if (currentTime - this.lastRenderTime < this.renderCooldown) {
        return;
      }

      this.parseTasksFromContext();
      this.lastRenderTime = currentTime;
    }

    // 设置SillyTavern事件监听器
    setupSillyTavernEventListeners() {
      // 防止重复设置
      if (this.eventListenersSetup) {
        return;
      }

      try {
        // 监听SillyTavern的事件系统
        const eventSource = window['eventSource'];
        const event_types = window['event_types'];

        if (eventSource && event_types) {
          this.eventListenersSetup = true;

          // 创建防抖函数，避免过于频繁的解析
          const debouncedParse = this.debounce(() => {
            this.parseTasksFromContext();
          }, 1000);

          // 监听消息发送事件
          if (event_types.MESSAGE_SENT) {
            eventSource.on(event_types.MESSAGE_SENT, debouncedParse);
          }

          // 监听消息接收事件
          if (event_types.MESSAGE_RECEIVED) {
            eventSource.on(event_types.MESSAGE_RECEIVED, debouncedParse);
          }

          // 监听聊天变化事件
          if (event_types.CHAT_CHANGED) {
            eventSource.on(event_types.CHAT_CHANGED, debouncedParse);
          }
        } else {
          // 减少重试频率，从2秒改为5秒
          setTimeout(() => {
            this.setupSillyTavernEventListeners();
          }, 5000);
        }
      } catch (error) {
        console.warn('[Task App] 设置SillyTavern事件监听器失败:', error);
      }
    }

    // 防抖函数
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    // 从上下文解析任务信息
    parseTasksFromContext() {
      try {
        // 获取当前任务数据
        const taskData = this.getCurrentTaskData();

        // 检查任务状态是否有变化
        const tasksChanged = taskData.tasks.length !== this.tasks.length || this.hasTasksChanged(taskData.tasks);
        const acceptedChanged =
          JSON.stringify(taskData.acceptedTasks.sort()) !== JSON.stringify(this.acceptedTasks.sort());
        const completedChanged =
          JSON.stringify(taskData.completedTasks.sort()) !== JSON.stringify(this.completedTasks.sort());

        // 如果有任何变化，更新数据并重新渲染
        if (tasksChanged || acceptedChanged || completedChanged) {
          console.log('[Task App] 检测到任务状态变化:', {
            tasksChanged,
            acceptedChanged,
            completedChanged,
            oldAccepted: this.acceptedTasks,
            newAccepted: taskData.acceptedTasks,
            oldCompleted: this.completedTasks,
            newCompleted: taskData.completedTasks,
          });

          this.tasks = taskData.tasks;
          this.acceptedTasks = taskData.acceptedTasks;
          this.completedTasks = taskData.completedTasks;
          this.updateTaskList();
        }
      } catch (error) {
        console.error('[Task App] 解析任务信息失败:', error);
      }
    }

    /**
     * 从消息中获取当前任务数据
     */
    getCurrentTaskData() {
      try {
        // 优先使用mobileContextEditor获取数据
        const mobileContextEditor = window['mobileContextEditor'];
        if (mobileContextEditor) {
          const chatData = mobileContextEditor.getCurrentChatData();
          if (chatData && chatData.messages && chatData.messages.length > 0) {
            const allContent = chatData.messages.map(msg => msg.mes || '').join('\n');
            return this.parseTaskContent(allContent);
          }
        }

        // 如果没有mobileContextEditor，尝试其他方式
        const chatData = this.getChatData();
        if (chatData && chatData.length > 0) {
          const allContent = chatData.map(msg => msg.mes || '').join('\n');
          return this.parseTaskContent(allContent);
        }
      } catch (error) {
        console.warn('[Task App] 获取任务数据失败:', error);
      }

      return { tasks: [], acceptedTasks: [], completedTasks: [] };
    }

    /**
     * 从消息中实时解析任务内容
     */
    parseTaskContent(content) {
      const tasks = [];
      const acceptedTasks = [];
      const completedTasks = [];

      // 解析任务格式: [任务|{{任务编号，例如r101}}|{{任务名称}}|{{任务介绍}}|{{发布人}}|{{奖励}}]
      const taskRegex = /\[任务\|([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\]]+)\]/g;

      let taskMatch;
      while ((taskMatch = taskRegex.exec(content)) !== null) {
        const [fullMatch, id, name, description, publisher, reward] = taskMatch;

        // 检查是否已存在相同任务
        const existingTask = tasks.find(t => t.id.trim() === id.trim());

        if (!existingTask) {
          const newTask = {
            id: id.trim(),
            name: name.trim(),
            description: description.trim(),
            publisher: publisher.trim(),
            reward: reward.trim(),
            timestamp: new Date().toLocaleString(),
            status: 'available',
          };
          tasks.push(newTask);
        }
      }

      // 解析接受任务格式: [接受任务|{{任务编号}}|...] 或 [接受任务|{{任务编号}}]
      const acceptTaskRegex = /\[接受任务\|([^\|\]]+)/g;
      let acceptMatch;
      while ((acceptMatch = acceptTaskRegex.exec(content)) !== null) {
        const taskId = acceptMatch[1].trim();
        if (!acceptedTasks.includes(taskId)) {
          acceptedTasks.push(taskId);
        }
      }

      // 解析完成任务格式: [完成任务|{{任务编号}}|...] 或 [完成任务|{{任务编号}}]
      const completeTaskRegex = /\[完成任务\|([^\|\]]+)/g;
      let completeMatch;
      while ((completeMatch = completeTaskRegex.exec(content)) !== null) {
        const taskId = completeMatch[1].trim();
        if (!completedTasks.includes(taskId)) {
          completedTasks.push(taskId);
        }
      }

      console.log(
        '[Task App] 解析完成，任务数:',
        tasks.length,
        '已接受:',
        acceptedTasks.length,
        '已完成:',
        completedTasks.length,
      );

      // 添加详细的调试信息
      if (tasks.length > 0) {
        console.log(
          '[Task App] 任务详情:',
          tasks.map(t => `${t.id}: ${t.name}`),
        );
      }
      if (acceptedTasks.length > 0) {
        console.log('[Task App] 已接受任务:', acceptedTasks);
      }
      if (completedTasks.length > 0) {
        console.log('[Task App] 已完成任务:', completedTasks);
      }

      return { tasks, acceptedTasks, completedTasks };
    }

    // 检查任务是否有变化
    hasTasksChanged(newTasks) {
      if (newTasks.length !== this.tasks.length) {
        return true;
      }

      for (let i = 0; i < newTasks.length; i++) {
        const newTask = newTasks[i];
        const oldTask = this.tasks[i];

        if (
          !oldTask ||
          newTask.id !== oldTask.id ||
          newTask.name !== oldTask.name ||
          newTask.description !== oldTask.description ||
          newTask.publisher !== oldTask.publisher ||
          newTask.reward !== oldTask.reward
        ) {
          return true;
        }
      }

      return false;
    }

    // 获取任务图标
    getTaskIcon(status) {
      const iconMap = {
        available: '📋',
        inProgress: '⏳',
        completed: '✅',
      };
      return iconMap[status] || iconMap['available'];
    }

    // 获取聊天数据
    getChatData() {
      try {
        // 优先使用mobileContextEditor获取数据
        const mobileContextEditor = window['mobileContextEditor'];
        if (mobileContextEditor) {
          const chatData = mobileContextEditor.getCurrentChatData();
          if (chatData && chatData.messages && chatData.messages.length > 0) {
            return chatData.messages;
          }
        }

        // 尝试从全局变量获取
        const chat = window['chat'];
        if (chat && Array.isArray(chat)) {
          return chat;
        }

        // 尝试从其他可能的位置获取
        const SillyTavern = window['SillyTavern'];
        if (SillyTavern && SillyTavern.chat) {
          return SillyTavern.chat;
        }

        return [];
      } catch (error) {
        console.error('[Task App] 获取聊天数据失败:', error);
        return [];
      }
    }

    // 获取应用内容
    getAppContent() {
      switch (this.currentView) {
        case 'taskList':
          return this.renderTaskList();
        case 'inProgress':
          return this.renderInProgress();
        case 'completed':
          return this.renderCompleted();
        default:
          return this.renderTaskList();
      }
    }

    // 渲染任务列表
    renderTaskList() {
      console.log('[Task App] 渲染任务列表...');

      const availableTasks = this.tasks.filter(
        task => !this.acceptedTasks.includes(task.id) && !this.completedTasks.includes(task.id),
      );

      const inProgressTasks = this.tasks.filter(
        task => this.acceptedTasks.includes(task.id) && !this.completedTasks.includes(task.id),
      );

      const completedTasks = this.tasks.filter(task => this.completedTasks.includes(task.id));

      const taskItems = availableTasks
        .map(
          task => `
            <div class="task-item" data-task-id="${task.id}">
                <div class="task-info">
                    <div class="task-header-row">
                        <div class="task-name">${task.name}</div>
                        <button class="accept-task-btn" data-task-id="${task.id}">
                            接取任务
                        </button>
                    </div>
                    <div class="task-id">任务ID: ${task.id}</div>
                    <div class="task-description">${task.description}</div>
                    <div class="task-reward">奖励: ${task.reward}</div>
                    <div class="task-publisher">发布人: ${task.publisher}</div>
                </div>
            </div>
        `,
        )
        .join('');

      const emptyState = `
            <div class="task-empty-state">
                <div class="empty-icon">📋</div>
                <div class="empty-title">暂无可接任务</div>
            </div>
        `;

      return `
            <div class="task-app">
                <!-- 标签页导航 -->
                <div class="task-tabs">
                    <button class="task-tab ${this.currentView === 'taskList' ? 'active' : ''}" data-view="taskList">
                        任务 (${availableTasks.length})
                    </button>
                    <button class="task-tab ${
                      this.currentView === 'inProgress' ? 'active' : ''
                    }" data-view="inProgress">
                        进行中 (${inProgressTasks.length})
                    </button>
                    <button class="task-tab ${this.currentView === 'completed' ? 'active' : ''}" data-view="completed">
                        已完成 (${completedTasks.length})
                    </button>
                </div>

                <!-- 任务内容 -->
                <div class="task-list">
                    <div class="task-grid">
                        ${availableTasks.length > 0 ? taskItems : emptyState}
                    </div>
                </div>
            </div>
        `;
    }

    // 渲染进行中任务
    renderInProgress() {
      console.log('[Task App] 渲染进行中任务...');

      const availableTasks = this.tasks.filter(
        task => !this.acceptedTasks.includes(task.id) && !this.completedTasks.includes(task.id),
      );

      const inProgressTasks = this.tasks.filter(
        task => this.acceptedTasks.includes(task.id) && !this.completedTasks.includes(task.id),
      );

      const completedTasks = this.tasks.filter(task => this.completedTasks.includes(task.id));

      const taskItems = inProgressTasks
        .map(
          task => `
            <div class="task-item" data-task-id="${task.id}">
                <div class="task-info">
                    <div class="task-header-row">
                        <div class="task-name">${task.name}</div>
                        <div class="task-status">进行中</div>
                    </div>
                    <div class="task-id">任务ID: ${task.id}</div>
                    <div class="task-description">${task.description}</div>
                    <div class="task-reward">奖励: ${task.reward}</div>
                    <div class="task-publisher">发布人: ${task.publisher}</div>
                </div>
            </div>
        `,
        )
        .join('');

      const emptyState = `
            <div class="task-empty-state">
                <div class="empty-icon">⏳</div>
                <div class="empty-title">暂无进行中任务</div>
                <div class="empty-subtitle">快去接受一些任务吧</div>
                <button class="back-to-tasks-btn">查看可接任务</button>
            </div>
        `;

      return `
            <div class="task-app">
                <!-- 标签页导航 -->
                <div class="task-tabs">
                    <button class="task-tab ${this.currentView === 'taskList' ? 'active' : ''}" data-view="taskList">
                        任务 (${availableTasks.length})
                    </button>
                    <button class="task-tab ${
                      this.currentView === 'inProgress' ? 'active' : ''
                    }" data-view="inProgress">
                        进行中 (${inProgressTasks.length})
                    </button>
                    <button class="task-tab ${this.currentView === 'completed' ? 'active' : ''}" data-view="completed">
                        已完成 (${completedTasks.length})
                    </button>
                </div>

                <!-- 任务内容 -->
                <div class="task-list">
                    <div class="task-grid">
                        ${inProgressTasks.length > 0 ? taskItems : emptyState}
                    </div>
                </div>
            </div>
        `;
    }

    // 渲染已完成任务
    renderCompleted() {
      console.log('[Task App] 渲染已完成任务...');

      const availableTasks = this.tasks.filter(
        task => !this.acceptedTasks.includes(task.id) && !this.completedTasks.includes(task.id),
      );

      const inProgressTasks = this.tasks.filter(
        task => this.acceptedTasks.includes(task.id) && !this.completedTasks.includes(task.id),
      );

      const completedTasks = this.tasks.filter(task => this.completedTasks.includes(task.id));

      const taskItems = completedTasks
        .map(
          task => `
            <div class="task-item completed" data-task-id="${task.id}">
                <div class="task-info">
                    <div class="task-header-row">
                        <div class="task-name">${task.name}</div>
                        <div class="task-status">已完成</div>
                    </div>
                    <div class="task-id">任务ID: ${task.id}</div>
                    <div class="task-description">${task.description}</div>
                    <div class="task-reward">奖励: ${task.reward}</div>
                    <div class="task-publisher">发布人: ${task.publisher}</div>
                </div>
            </div>
        `,
        )
        .join('');

      const emptyState = `
            <div class="task-empty-state">
                <div class="empty-icon">✅</div>
                <div class="empty-title">暂无已完成任务</div>
                <div class="empty-subtitle">完成任务后会在这里显示</div>
                <button class="back-to-tasks-btn">查看可接任务</button>
            </div>
        `;

      return `
            <div class="task-app">
                <!-- 标签页导航 -->
                <div class="task-tabs">
                    <button class="task-tab ${this.currentView === 'taskList' ? 'active' : ''}" data-view="taskList">
                        任务 (${availableTasks.length})
                    </button>
                    <button class="task-tab ${
                      this.currentView === 'inProgress' ? 'active' : ''
                    }" data-view="inProgress">
                        进行中 (${inProgressTasks.length})
                    </button>
                    <button class="task-tab ${this.currentView === 'completed' ? 'active' : ''}" data-view="completed">
                        已完成 (${completedTasks.length})
                    </button>
                </div>

                <!-- 任务内容 -->
                <div class="task-list">
                    <div class="task-grid">
                        ${completedTasks.length > 0 ? taskItems : emptyState}
                    </div>
                </div>
            </div>
        `;
    }

    // 更新任务列表
    updateTaskList() {
      console.log('[Task App] 更新任务列表...');
      this.updateAppContent();
    }

    // 更新应用内容
    updateAppContent() {
      const content = this.getAppContent();
      const appElement = document.getElementById('app-content');
      if (appElement) {
        appElement.innerHTML = content;
        // 延迟绑定事件，确保DOM已更新
        setTimeout(() => {
          this.bindEvents();
        }, 50);
      }
    }

    // 绑定事件
    bindEvents() {
      console.log('[Task App] 绑定事件...');

      // 在应用容器内查找元素，避免与其他应用冲突
      const appContainer = document.getElementById('app-content');
      if (!appContainer) {
        console.error('[Task App] 应用容器未找到');
        return;
      }

      // 接受任务按钮点击事件
      appContainer.querySelectorAll('.accept-task-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          const taskId = e.target.dataset.taskId;
          console.log('[Task App] 点击接受任务按钮:', taskId);
          this.acceptTask(taskId);
        });
      });

      // 返回任务列表按钮
      appContainer.querySelectorAll('.back-to-tasks-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[Task App] 点击返回任务列表按钮');
          this.showTaskList();
        });
      });

      // 标签页切换事件
      appContainer.querySelectorAll('.task-tab').forEach(tab => {
        tab.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          const view = e.target.dataset.view;
          console.log('[Task App] 点击标签页:', view);
          this.switchView(view);
        });
      });

      // 刷新任务按钮事件
      appContainer.querySelectorAll('.refresh-tasks-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[Task App] 点击刷新任务按钮');
          this.refreshTaskList();
          this.showToast('正在刷新任务状态...', 'info');
        });
      });

      console.log(
        '[Task App] 事件绑定完成 - 标签页:',
        appContainer.querySelectorAll('.task-tab').length,
        '个, 刷新按钮:',
        appContainer.querySelectorAll('.refresh-tasks-btn').length,
        '个',
      );
    }

    // 接受任务
    acceptTask(taskId) {
      console.log('[Task App] 接受任务:', taskId);

      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        const message = `[接受任务|${task.id}|${task.name}|${task.description}|${task.publisher}|${task.reward}]`;
        this.sendToSillyTavern(message);
        this.showToast('任务接受成功！', 'success');

        // 立即更新状态
        if (!this.acceptedTasks.includes(taskId)) {
          this.acceptedTasks.push(taskId);
          this.updateAppContent();
        }

        // 设置定时检查，等待AI回复后更新状态
        this.scheduleTaskStatusCheck(taskId, 'accepted');
      }
    }

    // 安排任务状态检查
    scheduleTaskStatusCheck(taskId, action) {
      console.log(`[Task App] 安排任务状态检查: ${taskId} (${action})`);

      // 5秒后再次检查
      setTimeout(() => {
        this.parseTasksFromContext();
      }, 5000);

      // 10秒后最后检查
      setTimeout(() => {
        this.parseTasksFromContext();
      }, 10000);
    }

    // 切换视图
    switchView(view) {
      console.log('[Task App] 切换视图:', view);
      this.currentView = view;
      this.updateAppContent();
      this.updateHeader();
    }

    // 显示任务列表
    showTaskList() {
      this.switchView('taskList');
    }

    // 显示进行中任务
    showInProgress() {
      this.switchView('inProgress');
    }

    // 显示已完成任务
    showCompleted() {
      this.switchView('completed');
    }

    // 发送查看任务消息
    sendViewTasksMessage() {
      try {
        console.log('[Task App] 发送查看任务消息');

        const message = '查看任务';

        // 使用与消息app相同的发送方式
        this.sendToSillyTavern(message);
      } catch (error) {
        console.error('[Task App] 发送查看任务消息失败:', error);
      }
    }

    // 发送消息到SillyTavern
    async sendToSillyTavern(message) {
      try {
        console.log('[Task App] 发送消息到SillyTavern:', message);

        // 尝试找到文本输入框
        const textarea = document.querySelector('#send_textarea');
        if (!textarea) {
          console.error('[Task App] 未找到消息输入框');
          return this.sendToSillyTavernBackup(message);
        }

        // 设置消息内容
        textarea.value = message;
        textarea.focus();

        // 触发输入事件
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        // 触发发送按钮点击
        const sendButton = document.querySelector('#send_but');
        if (sendButton) {
          sendButton.click();
          console.log('[Task App] 已点击发送按钮');
          return true;
        }

        return this.sendToSillyTavernBackup(message);
      } catch (error) {
        console.error('[Task App] 发送消息时出错:', error);
        return this.sendToSillyTavernBackup(message);
      }
    }

    // 备用发送方法
    async sendToSillyTavernBackup(message) {
      try {
        console.log('[Task App] 尝试备用发送方法:', message);

        const textareas = document.querySelectorAll('textarea');
        if (textareas.length > 0) {
          const textarea = textareas[0];
          textarea.value = message;
          textarea.focus();

          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          return true;
        }

        return false;
      } catch (error) {
        console.error('[Task App] 备用发送方法失败:', error);
        return false;
      }
    }

    // 手动刷新任务列表
    refreshTaskList() {
      console.log('[Task App] 手动刷新任务列表');

      // 强制重新解析任务数据
      this.parseTasksFromContext();

      // 更新界面
      this.updateAppContent();

      // 显示刷新成功提示
      setTimeout(() => {
        this.showToast('任务状态已更新', 'success');
      }, 500);
    }

    // 销毁应用，清理资源
    destroy() {
      console.log('[Task App] 销毁应用，清理资源');

      // 清理定时器
      if (this.contextCheckInterval) {
        clearInterval(this.contextCheckInterval);
        this.contextCheckInterval = null;
      }

      // 重置状态
      this.eventListenersSetup = false;
      this.isAutoRenderEnabled = false;

      // 清空数据
      this.tasks = [];
      this.acceptedTasks = [];
      this.completedTasks = [];
    }

    // 更新header
    updateHeader() {
      // 通知mobile-phone更新header
      if (window.mobilePhone && window.mobilePhone.updateAppHeader) {
        const state = {
          app: 'task',
          title: this.getViewTitle(),
          view: this.currentView,
        };
        window.mobilePhone.updateAppHeader(state);
      }
    }

    // 获取视图标题
    getViewTitle() {
      switch (this.currentView) {
        case 'taskList':
          return '任务大厅';
        case 'inProgress':
          return '进行中';
        case 'completed':
          return '已完成';
        default:
          return '任务大厅';
      }
    }

    // 显示提示消息
    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `task-toast ${type}`;
      toast.textContent = message;

      document.body.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('show');
      }, 100);

      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          toast.remove();
        }, 300);
      }, 3000);
    }
  }

  // 创建全局实例
  window.TaskApp = TaskApp;
  window.taskApp = new TaskApp();
} // 结束类定义检查

// 全局函数供调用
window.getTaskAppContent = function () {
  console.log('[Task App] 获取任务应用内容');

  if (!window.taskApp) {
    console.error('[Task App] taskApp实例不存在');
    return '<div class="error-message">任务应用加载失败</div>';
  }

  try {
    return window.taskApp.getAppContent();
  } catch (error) {
    console.error('[Task App] 获取应用内容失败:', error);
    return '<div class="error-message">任务应用内容加载失败</div>';
  }
};

window.bindTaskAppEvents = function () {
  console.log('[Task App] 绑定任务应用事件');

  if (!window.taskApp) {
    console.error('[Task App] taskApp实例不存在');
    return;
  }

  try {
    // 延迟绑定，确保DOM完全加载
    setTimeout(() => {
      window.taskApp.bindEvents();
    }, 100);
  } catch (error) {
    console.error('[Task App] 绑定事件失败:', error);
  }
};

window.taskAppShowInProgress = function () {
  if (window.taskApp) {
    window.taskApp.showInProgress();
  }
};

window.taskAppShowCompleted = function () {
  if (window.taskApp) {
    window.taskApp.showCompleted();
  }
};

window.taskAppRefresh = function () {
  if (window.taskApp) {
    window.taskApp.refreshTaskList();
  }
};

window.taskAppSendViewMessage = function () {
  if (window.taskApp) {
    window.taskApp.sendViewTasksMessage();
  }
};

window.taskAppDebugInfo = function () {
  if (window.taskApp) {
    console.log('[Task App Debug] 当前任务数量:', window.taskApp.tasks.length);
    console.log('[Task App Debug] 任务列表:', window.taskApp.tasks);
    console.log('[Task App Debug] 已接受任务:', window.taskApp.acceptedTasks);
    console.log('[Task App Debug] 已完成任务:', window.taskApp.completedTasks);
    console.log('[Task App Debug] 当前视图:', window.taskApp.currentView);
    console.log('[Task App Debug] 事件监听器设置:', window.taskApp.eventListenersSetup);
    console.log('[Task App Debug] 自动渲染启用:', window.taskApp.isAutoRenderEnabled);
  }
};

window.taskAppDestroy = function () {
  if (window.taskApp) {
    window.taskApp.destroy();
    console.log('[Task App] 应用已销毁');
  }
};

window.taskAppForceReload = function () {
  console.log('[Task App] 🔄 强制重新加载应用...');

  // 先销毁旧实例
  if (window.taskApp) {
    window.taskApp.destroy();
  }

  // 创建新实例
  window.taskApp = new TaskApp();
  console.log('[Task App] ✅ 应用已重新加载 - 版本 2.0');
};

window.taskAppForceRefresh = function () {
  console.log('[Task App] 🔄 强制刷新任务状态...');

  if (window.taskApp) {
    // 强制重新解析
    window.taskApp.parseTasksFromContext();
    window.taskApp.updateAppContent();
    window.taskApp.showToast('强制刷新完成', 'success');
  } else {
    console.error('[Task App] taskApp实例不存在');
  }
};

window.taskAppTestTabs = function () {
  console.log('[Task App] 🧪 测试标签页点击事件...');

  const tabs = document.querySelectorAll('.task-tab');
  console.log('[Task App] 找到标签页数量:', tabs.length);

  tabs.forEach((tab, index) => {
    console.log(`[Task App] 标签页 ${index + 1}:`, {
      text: tab.textContent.trim(),
      view: tab.dataset.view,
      active: tab.classList.contains('active'),
    });
  });

  if (tabs.length > 0) {
    console.log('[Task App] 尝试点击第二个标签页...');
    const secondTab = tabs[1];
    if (secondTab) {
      secondTab.click();
      console.log('[Task App] 已触发点击事件');
    }
  }
};

console.log('[Task App] 任务应用模块加载完成 - 版本 2.0');
