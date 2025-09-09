/**
 * Task App - แอปงาน
 * 基于รูปแบบของ shop-app.js ให้ฟังก์ชันงานสำหรับ mobile-phone.js
 */

// @ts-nocheck
// หลีกเลี่ยงการกำหนดซ้ำ
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
      console.log('[Task App] เริ่ม初始化แอปงาน - เวอร์ชัน 2.0');

      // วิเคราะห์ข้อมูลงานทันที
      this.parseTasksFromContext();

      // 初始化การตรวจสอบแบบอะซิงโครนัส เพื่อหลีกเลี่ยงการบล็อกการเรนเดอร์อินเทอร์เฟซ
      setTimeout(() => {
        this.setupContextMonitor();
      }, 100);

      console.log('[Task App] 初始化แอปงานเสร็จ - เวอร์ชัน 2.0');
    }

    // ตั้งค่าการตรวจสอบบริบท
    setupContextMonitor() {
      console.log('[Task App] ตั้งค่าการตรวจสอบบริบท...');

      // ฟังเหตุการณ์การเปลี่ยนแปลงบริบท
      if (window.addEventListener) {
        window.addEventListener('contextUpdate', event => {
          this.handleContextChange(event);
        });

        // ฟังเหตุการณ์การอัปเดตข้อความ
        window.addEventListener('messageUpdate', event => {
          this.handleContextChange(event);
        });

        // ฟังเหตุการณ์การเปลี่ยนแปลงแชท
        window.addEventListener('chatChanged', event => {
          this.handleContextChange(event);
        });

        // ฟังการเปลี่ยนแปลง DOM ตรวจสอบข้อความใหม่
        this.setupDOMObserver();
      }

      // เพิ่มความถี่การตรวจสอบ定时 จาก 10 วินาทีเป็น 3 วินาที
      this.contextCheckInterval = setInterval(() => {
        this.checkContextChanges();
      }, 5000);

      // ฟังระบบเหตุการณ์ของ SillyTavern
      this.setupSillyTavernEventListeners();
    }

    // ตั้งค่าตัวสังเกต DOM
    setupDOMObserver() {
      try {
        // สังเกตการเปลี่ยนแปลงของคอนเทนเนอร์แชท
        const chatContainer =
          document.querySelector('#chat') || document.querySelector('.mes') || document.querySelector('[data-mes]');
        if (chatContainer) {
          const observer = new MutationObserver(mutations => {
            let shouldUpdate = false;
            mutations.forEach(mutation => {
              if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // ตรวจสอบว่ามีการเพิ่มโหนดข้อความใหม่หรือไม่
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
              console.log('[Task App] ตรวจพบข้อความใหม่ อัปเดตสถานะงาน');
              setTimeout(() => {
                this.parseTasksFromContext();
              }, 500);
            }
          });

          observer.observe(chatContainer, {
            childList: true,
            subtree: true,
          });

          console.log('[Task App] ตั้งค่าตัวสังเกต DOM สำเร็จ');
        }
      } catch (error) {
        console.warn('[Task App] ตั้งค่าตัวสังเกต DOM ล้มเหลว:', error);
      }
    }

    // จัดการการเปลี่ยนแปลงบริบท
    handleContextChange(event) {
      console.log('[Task App] การเปลี่ยนแปลงบริบท:', event);
      this.parseTasksFromContext();
    }

    // ตรวจสอบการเปลี่ยนแปลงบริบท
    checkContextChanges() {
      if (!this.isAutoRenderEnabled) return;

      const currentTime = Date.now();
      if (currentTime - this.lastRenderTime < this.renderCooldown) {
        return;
      }

      this.parseTasksFromContext();
      this.lastRenderTime = currentTime;
    }

    // ตั้งค่าฟังก์ชันฟังเหตุการณ์ของ SillyTavern
    setupSillyTavernEventListeners() {
      // ป้องกันการตั้งค่าซ้ำ
      if (this.eventListenersSetup) {
        return;
      }

      try {
        // ฟังระบบเหตุการณ์ของ SillyTavern
        const eventSource = window['eventSource'];
        const event_types = window['event_types'];

        if (eventSource && event_types) {
          this.eventListenersSetup = true;

          // สร้างฟังก์ชันเด้ง เพื่อหลีกเลี่ยงการวิเคราะห์บ่อยเกินไป
          const debouncedParse = this.debounce(() => {
            this.parseTasksFromContext();
          }, 1000);

          // ฟังเหตุการณ์ส่งข้อความ
          if (event_types.MESSAGE_SENT) {
            eventSource.on(event_types.MESSAGE_SENT, debouncedParse);
          }

          // ฟังเหตุการณ์รับข้อความ
          if (event_types.MESSAGE_RECEIVED) {
            eventSource.on(event_types.MESSAGE_RECEIVED, debouncedParse);
          }

          // ฟังเหตุการณ์การเปลี่ยนแปลงแชท
          if (event_types.CHAT_CHANGED) {
            eventSource.on(event_types.CHAT_CHANGED, debouncedParse);
          }
        } else {
          // ลดความถี่การลองใหม่ จาก 2 วินาทีเป็น 5 วินาที
          setTimeout(() => {
            this.setupSillyTavernEventListeners();
          }, 5000);
        }
      } catch (error) {
        console.warn('[Task App] ตั้งค่าฟังก์ชันฟังเหตุการณ์ของ SillyTavern ล้มเหลว:', error);
      }
    }

    // ฟังก์ชันเด้ง
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

    // วิเคราะห์ข้อมูลงานจากบริบท
    parseTasksFromContext() {
      try {
        // ดึงข้อมูลงานปัจจุบัน
        const taskData = this.getCurrentTaskData();

        // ตรวจสอบว่าสถานะงานมีการเปลี่ยนแปลงหรือไม่
        const tasksChanged = taskData.tasks.length !== this.tasks.length || this.hasTasksChanged(taskData.tasks);
        const acceptedChanged =
          JSON.stringify(taskData.acceptedTasks.sort()) !== JSON.stringify(this.acceptedTasks.sort());
        const completedChanged =
          JSON.stringify(taskData.completedTasks.sort()) !== JSON.stringify(this.completedTasks.sort());

        // หากมีการเปลี่ยนแปลงใดๆ อัปเดตข้อมูลและเรนเดอร์ใหม่
        if (tasksChanged || acceptedChanged || completedChanged) {
          console.log('[Task App] ตรวจพบการเปลี่ยนแปลงสถานะงาน:', {
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
        console.error('[Task App] วิเคราะห์ข้อมูลงานล้มเหลว:', error);
      }
    }

    /**
     * ดึงข้อมูลงานปัจจุบันจากข้อความ
     */
    getCurrentTaskData() {
      try {
        // 優先ใช้ mobileContextEditor เพื่อดึงข้อมูล
        const mobileContextEditor = window['mobileContextEditor'];
        if (mobileContextEditor) {
          const chatData = mobileContextEditor.getCurrentChatData();
          if (chatData && chatData.messages && chatData.messages.length > 0) {
            const allContent = chatData.messages.map(msg => msg.mes || '').join('\n');
            return this.parseTaskContent(allContent);
          }
        }

        // หากไม่มี mobileContextEditor ลองวิธีอื่น
        const chatData = this.getChatData();
        if (chatData && chatData.length > 0) {
          const allContent = chatData.map(msg => msg.mes || '').join('\n');
          return this.parseTaskContent(allContent);
        }
      } catch (error) {
        console.warn('[Task App] ดึงข้อมูลงานล้มเหลว:', error);
      }

      return { tasks: [], acceptedTasks: [], completedTasks: [] };
    }

    /**
     * วิเคราะห์เนื้อหางานแบบเรียลไทม์จากข้อความ
     */
    parseTaskContent(content) {
      const tasks = [];
      const acceptedTasks = [];
      const completedTasks = [];

      // วิเคราะห์รูปแบบงาน: [งาน|{{หมายเลขงาน เช่น r101}}|{{ชื่องาน}}|{{คำแนะนำงาน}}|{{ผู้เผยแพร่}}|{{รางวัล}}]
      const taskRegex = /\[งาน\|([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\]]+)\]/g;

      let taskMatch;
      while ((taskMatch = taskRegex.exec(content)) !== null) {
        const [fullMatch, id, name, description, publisher, reward] = taskMatch;

        // ตรวจสอบว่ามีงานเดียวกันอยู่แล้วหรือไม่
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

      // วิเคราะห์รูปแบบรับงาน: [รับงาน|{{หมายเลขงาน}}|...] หรือ [รับงาน|{{หมายเลขงาน}}]
      const acceptTaskRegex = /\[รับงาน\|([^\|\]]+)/g;
      let acceptMatch;
      while ((acceptMatch = acceptTaskRegex.exec(content)) !== null) {
        const taskId = acceptMatch[1].trim();
        if (!acceptedTasks.includes(taskId)) {
          acceptedTasks.push(taskId);
        }
      }

      // วิเคราะห์รูปแบบเสร็จงาน: [เสร็จงาน|{{หมายเลขงาน}}|...] หรือ [เสร็จงาน|{{หมายเลขงาน}}]
      const completeTaskRegex = /\[เสร็จงาน\|([^\|\]]+)/g;
      let completeMatch;
      while ((completeMatch = completeTaskRegex.exec(content)) !== null) {
        const taskId = completeMatch[1].trim();
        if (!completedTasks.includes(taskId)) {
          completedTasks.push(taskId);
        }
      }

      console.log(
        '[Task App] วิเคราะห์เสร็จ จำนวนงาน:',
        tasks.length,
        'รับแล้ว:',
        acceptedTasks.length,
        'เสร็จแล้ว:',
        completedTasks.length,
      );

      // เพิ่มข้อมูลดีบักละเอียด
      if (tasks.length > 0) {
        console.log(
          '[Task App] รายละเอียดงาน:',
          tasks.map(t => `${t.id}: ${t.name}`),
        );
      }
      if (acceptedTasks.length > 0) {
        console.log('[Task App] งานที่รับแล้ว:', acceptedTasks);
      }
      if (completedTasks.length > 0) {
        console.log('[Task App] งานที่เสร็จแล้ว:', completedTasks);
      }

      return { tasks, acceptedTasks, completedTasks };
    }

    // ตรวจสอบว่างานมีการเปลี่ยนแปลงหรือไม่
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

    // ดึงเนื้อหาแอป
    getAppContent() {
      switch (this.currentView) {
        case 'taskList':
          return this.renderTaskList();
        case 'inProgress':
          return this.renderInProgressTasks();
        case 'completed':
          return this.renderCompletedTasks();
        default:
          return this.renderTaskList();
      }
    }

    // เรนเดอร์รายการงาน
    renderTaskList() {
      console.log('[Task App] เรนเดอร์รายการงาน...');

      if (!this.tasks.length) {
        return `
          <div class="task-empty-state">
            <div class="empty-icon">📋</div>
            <div class="empty-title">ไม่มีงานใหม่</div>
            <div class="empty-subtitle">คลิก "รีเฟรช" เพื่อดึงงานใหม่</div>
          </div>
        `;
      }

      // กรองงานที่ยังไม่รับ
      const availableTasks = this.tasks.filter(task => !this.acceptedTasks.includes(task.id) && !this.completedTasks.includes(task.id));

      if (!availableTasks.length) {
        return `
          <div class="task-empty-state">
            <div class="empty-icon">✅</div>
            <div class="empty-title">ไม่มีงานใหม่</div>
            <div class="empty-subtitle">คุณรับงานทั้งหมดแล้ว! ตรวจสอบ "กำลังดำเนินการ" หรือ "เสร็จสิ้น"</div>
          </div>
        `;
      }

      const taskCards = availableTasks.map(task => `
        <div class="task-card" data-task-id="${task.id}">
          <div class="task-header">
            <h3 class="task-name">${task.name}</h3>
            <div class="task-publisher">ผู้เผยแพร่: ${task.publisher}</div>
          </div>
          <div class="task-description">${task.description}</div>
          <div class="task-reward">รางวัล: ${task.reward}</div>
          <button class="accept-task-btn" data-task-id="${task.id}">รับงาน</button>
        </div>
      `).join('');

      return `
        <div class="task-list">
          <div class="task-tabs">
            <button class="task-tab active" data-view="taskList">งานใหม่</button>
            <button class="task-tab" data-view="inProgress">กำลังดำเนินการ</button>
            <button class="task-tab" data-view="completed">เสร็จสิ้น</button>
          </div>
          <button class="refresh-tasks-btn">รีเฟรชงาน</button>
          <div class="tasks-container">
            ${taskCards}
          </div>
        </div>
      `;
    }

    // เรนเดอร์งานกำลังดำเนินการ
    renderInProgressTasks() {
      const inProgressTasks = this.tasks.filter(task => this.acceptedTasks.includes(task.id) && !this.completedTasks.includes(task.id));

      if (!inProgressTasks.length) {
        return `
          <div class="task-empty-state">
            <div class="empty-icon">⏳</div>
            <div class="empty-title">ไม่มีงานกำลังดำเนินการ</div>
            <div class="empty-subtitle">รับงานใหม่จาก "งานใหม่"</div>
          </div>
        `;
      }

      const taskCards = inProgressTasks.map(task => `
        <div class="task-card in-progress" data-task-id="${task.id}">
          <div class="task-header">
            <h3 class="task-name">${task.name}</h3>
            <div class="task-publisher">ผู้เผยแพร่: ${task.publisher}</div>
          </div>
          <div class="task-description">${task.description}</div>
          <div class="task-reward">รางวัล: ${task.reward}</div>
          <div class="task-status">กำลังดำเนินการ...</div>
        </div>
      `).join('');

      return `
        <div class="task-list">
          <button class="back-to-tasks-btn">← กลับไปงานใหม่</button>
          <div class="tasks-container">
            ${taskCards}
          </div>
        </div>
      `;
    }

    // เรนเดอร์งานเสร็จสิ้น
    renderCompletedTasks() {
      const completedTasks = this.tasks.filter(task => this.completedTasks.includes(task.id));

      if (!completedTasks.length) {
        return `
          <div class="task-empty-state">
            <div class="empty-icon">🎉</div>
            <div class="empty-title">ยังไม่มีงานเสร็จสิ้น</div>
            <div class="empty-subtitle">เสร็จงานเพื่อดูที่นี่</div>
          </div>
        `;
      }

      const taskCards = completedTasks.map(task => `
        <div class="task-card completed" data-task-id="${task.id}">
          <div class="task-header">
            <h3 class="task-name">${task.name}</h3>
            <div class="task-publisher">ผู้เผยแพร่: ${task.publisher}</div>
          </div>
          <div class="task-description">${task.description}</div>
          <div class="task-reward">รางวัล: ${task.reward}</div>
          <div class="task-status">เสร็จสิ้น ✅</div>
        </div>
      `).join('');

      return `
        <div class="task-list">
          <button class="back-to-tasks-btn">← กลับไปงานใหม่</button>
          <div class="tasks-container">
            ${taskCards}
          </div>
        </div>
      `;
    }

    // อัปเดตรายการงาน
    updateTaskList() {
      this.updateAppContent();
    }

    // อัปเดตเนื้อหาแอป
    updateAppContent() {
      const appContent = document.getElementById('app-content');
      if (appContent) {
        appContent.innerHTML = this.getAppContent();
        // ผูกเหตุการณ์หลังอัปเดต
        this.bindEvents();
      }
    }

    // ผูกเหตุการณ์
    bindEvents() {
      console.log('[Task App] ผูกเหตุการณ์...');

      const appContainer = document.getElementById('app-content');
      if (!appContainer) {
        console.error('[Task App] ไม่พบคอนเทนเนอร์แอป');
        return;
      }

      // เหตุการณ์คลิกปุ่มรับงาน
      appContainer.querySelectorAll('.accept-task-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          const taskId = e.target.dataset.taskId;
          console.log('[Task App] คลิกปุ่มรับงาน:', taskId);
          this.acceptTask(taskId);
        });
      });

      // ปุ่มกลับไปรายการงาน
      appContainer.querySelectorAll('.back-to-tasks-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[Task App] คลิกปุ่มกลับไปรายการงาน');
          this.showTaskList();
        });
      });

      // เหตุการณ์สลับแท็บ
      appContainer.querySelectorAll('.task-tab').forEach(tab => {
        tab.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          const view = e.target.dataset.view;
          console.log('[Task App] คลิกแท็บ:', view);
          this.switchView(view);
        });
      });

      // เหตุการณ์ปุ่มรีเฟรชงาน
      appContainer.querySelectorAll('.refresh-tasks-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[Task App] คลิกปุ่มรีเฟรชงาน');
          this.refreshTaskList();
          this.showToast('กำลังรีเฟรชสถานะงาน...', 'info');
        });
      });

      console.log(
        '[Task App] ผูกเหตุการณ์เสร็จ - แท็บ:',
        appContainer.querySelectorAll('.task-tab').length,
        'ชิ้น, ปุ่มรีเฟรช:',
        appContainer.querySelectorAll('.refresh-tasks-btn').length,
        'ชิ้น',
      );
    }

    // รับงาน
    acceptTask(taskId) {
      console.log('[Task App] รับงาน:', taskId);

      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        const message = `[รับงาน|${task.id}|${task.name}|${task.description}|${task.publisher}|${task.reward}]`;
        this.sendToSillyTavern(message);
        this.showToast('รับงานสำเร็จ!', 'success');

        // อัปเดตสถานะทันที
        if (!this.acceptedTasks.includes(taskId)) {
          this.acceptedTasks.push(taskId);
          this.updateAppContent();
        }

        // ตั้งค่าการตรวจสอบสถานะงานตามเวลา รอการตอบกลับของ AI แล้วอัปเดตสถานะ
        this.scheduleTaskStatusCheck(taskId, 'accepted');
      }
    }

    // จัดการตรวจสอบสถานะงาน
    scheduleTaskStatusCheck(taskId, action) {
      console.log(`[Task App] จัดการตรวจสอบสถานะงาน: ${taskId} (${action})`);

      // ตรวจสอบอีกครั้งหลัง 5 วินาที
      setTimeout(() => {
        this.parseTasksFromContext();
      }, 5000);

      // ตรวจสอบสุดท้ายหลัง 10 วินาที
      setTimeout(() => {
        this.parseTasksFromContext();
      }, 10000);
    }

    // สลับมุมมอง
    switchView(view) {
      console.log('[Task App] สลับมุมมอง:', view);
      this.currentView = view;
      this.updateAppContent();
      this.updateHeader();
    }

    // แสดงรายการงาน
    showTaskList() {
      this.switchView('taskList');
    }

    // แสดงงานกำลังดำเนินการ
    showInProgress() {
      this.switchView('inProgress');
    }

    // แสดงงานเสร็จสิ้น
    showCompleted() {
      this.switchView('completed');
    }

    // ส่งข้อความดูงาน
    sendViewTasksMessage() {
      try {
        console.log('[Task App] ส่งข้อความดูงาน');

        const message = 'ดูงาน';

        // ใช้การส่งเหมือนกับ message app
        this.sendToSillyTavern(message);
      } catch (error) {
        console.error('[Task App] ส่งข้อความดูงานล้มเหลว:', error);
      }
    }

    // ส่งข้อความไปยัง SillyTavern
    async sendToSillyTavern(message) {
      try {
        console.log('[Task App] ส่งข้อความไปยัง SillyTavern:', message);

        // ลองหาช่องกรอกข้อความ
        const textarea = document.querySelector('#send_textarea');
        if (!textarea) {
          console.error('[Task App] ไม่พบช่องกรอกข้อความ');
          return this.sendToSillyTavernBackup(message);
        }

        // ตั้งค่าเนื้อหาข้อความ
        textarea.value = message;
        textarea.focus();

        // กระตุ้นเหตุการณ์กรอก
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        // กระตุ้นคลิกปุ่มส่ง
        const sendButton = document.querySelector('#send_but');
        if (sendButton) {
          sendButton.click();
          console.log('[Task App] คลิกปุ่มส่งแล้ว');
          return true;
        }

        return this.sendToSillyTavernBackup(message);
      } catch (error) {
        console.error('[Task App] เกิดข้อผิดพลาดในการส่งข้อความ:', error);
        return this.sendToSillyTavernBackup(message);
      }
    }

    // วิธีส่งสำรอง
    async sendToSillyTavernBackup(message) {
      try {
        console.log('[Task App] ลองวิธีส่งสำรอง:', message);

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
        console.error('[Task App] วิธีส่งสำรองล้มเหลว:', error);
        return false;
      }
    }

    // รีเฟรชรายการงานด้วยตนเอง
    refreshTaskList() {
      console.log('[Task App] รีเฟรชรายการงานด้วยตนเอง');

      // บังคับวิเคราะห์ข้อมูลงานใหม่
      this.parseTasksFromContext();

      // อัปเดตอินเทอร์เฟซ
      this.updateAppContent();

      // แสดงคำใบ้รีเฟรชสำเร็จ
      setTimeout(() => {
        this.showToast('อัปเดตสถานะงานแล้ว', 'success');
      }, 500);
    }

    // ทำลายแอป ทำความสะอาดทรัพยากร
    destroy() {
      console.log('[Task App] ทำลายแอป ทำความสะอาดทรัพยากร');

      // ทำความสะอาดตัวจับเวลา
      if (this.contextCheckInterval) {
        clearInterval(this.contextCheckInterval);
        this.contextCheckInterval = null;
      }

      // รีเซ็ตสถานะ
      this.eventListenersSetup = false;
      this.isAutoRenderEnabled = false;

      // ล้างข้อมูล
      this.tasks = [];
      this.acceptedTasks = [];
      this.completedTasks = [];
    }

    // อัปเดต header
    updateHeader() {
      // แจ้ง mobile-phone เพื่ออัปเดต header
      if (window.mobilePhone && window.mobilePhone.updateAppHeader) {
        const state = {
          app: 'task',
          title: this.getViewTitle(),
          view: this.currentView,
        };
        window.mobilePhone.updateAppHeader(state);
      }
    }

    // ดึงชื่อมุมมอง
    getViewTitle() {
      switch (this.currentView) {
        case 'taskList':
          return 'หองาน';
        case 'inProgress':
          return 'กำลังดำเนินการ';
        case 'completed':
          return 'เสร็จสิ้น';
        default:
          return 'หองาน';
      }
    }

    // แสดงข้อความแจ้งเตือน
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

  // สร้างอินสแตนซ์ทั่วไป
  window.TaskApp = TaskApp;
  window.taskApp = new TaskApp();
} // สิ้นสุดการตรวจสอบนิยามคลาส

// ฟังก์ชันทั่วไปสำหรับเรียกใช้
window.getTaskAppContent = function () {
  console.log('[Task App] ดึงเนื้อหาแอปงาน');

  if (!window.taskApp) {
    console.error('[Task App] อินสแตนซ์ taskApp ไม่มี');
    return '<div class="error-message">โหลดแอปงานล้มเหลว</div>';
  }

  try {
    return window.taskApp.getAppContent();
  } catch (error) {
    console.error('[Task App] ดึงเนื้อหาแอปล้มเหลว:', error);
    return '<div class="error-message">โหลดเนื้อหาแอปงานล้มเหลว</div>';
  }
};

window.bindTaskAppEvents = function () {
  console.log('[Task App] ผูกเหตุการณ์แอปงาน');

  if (!window.taskApp) {
    console.error('[Task App] อินสแตนซ์ taskApp ไม่มี');
    return;
  }

  try {
    // ล่าช้าผูก เพื่อให้แน่ใจว่า DOM โหลดสมบูรณ์
    setTimeout(() => {
      window.taskApp.bindEvents();
    }, 100);
  } catch (error) {
    console.error('[Task App] ผูกเหตุการณ์ล้มเหลว:', error);
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
    console.log('[Task App Debug] จำนวนงานปัจจุบัน:', window.taskApp.tasks.length);
    console.log('[Task App Debug] รายการงาน:', window.taskApp.tasks);
    console.log('[Task App Debug] งานที่รับแล้ว:', window.taskApp.acceptedTasks);
    console.log('[Task App Debug] งานที่เสร็จแล้ว:', window.taskApp.completedTasks);
    console.log('[Task App Debug] มุมมองปัจจุบัน:', window.taskApp.currentView);
    console.log('[Task App Debug] ตั้งค่าฟังก์ชันฟังเหตุการณ์:', window.taskApp.eventListenersSetup);
    console.log('[Task App Debug] เปิดใช้งานการเรนเดอร์อัตโนมัติ:', window.taskApp.isAutoRenderEnabled);
  }
};

window.taskAppDestroy = function () {
  if (window.taskApp) {
    window.taskApp.destroy();
    console.log('[Task App] แอปถูกทำลายแล้ว');
  }
};

window.taskAppForceReload = function () {
  console.log('[Task App] 🔄 โหลดแอปใหม่แบบบังคับ...');

  // ทำลายอินสแตนซ์เก่าก่อน
  if (window.taskApp) {
    window.taskApp.destroy();
  }

  // สร้างอินสแตนซ์ใหม่
  window.taskApp = new TaskApp();
  console.log('[Task App] ✅ โหลดแอปใหม่แล้ว - เวอร์ชัน 2.0');
};

window.taskAppForceRefresh = function () {
  console.log('[Task App] 🔄 รีเฟรชสถานะงานแบบบังคับ...');

  if (window.taskApp) {
    // บังคับวิเคราะห์ใหม่
    window.taskApp.parseTasksFromContext();
    window.taskApp.updateAppContent();
    window.taskApp.showToast('รีเฟรชแบบบังคับเสร็จ', 'success');
  } else {
    console.error('[Task App] อินสแตนซ์ taskApp ไม่มี');
  }
};

window.taskAppTestTabs = function () {
  console.log('[Task App] 🧪 ทดสอบเหตุการณ์คลิกแท็บ...');

  const tabs = document.querySelectorAll('.task-tab');
  console.log('[Task App] พบจำนวนแท็บ:', tabs.length);

  tabs.forEach((tab, index) => {
    console.log(`[Task App] แท็บ ${index + 1}:`, {
      text: tab.textContent.trim(),
      view: tab.dataset.view,
      active: tab.classList.contains('active'),
    });
  });

  if (tabs.length > 0) {
    console.log('[Task App] ลองคลิกแท็บที่สอง...');
    const secondTab = tabs[1];
    if (secondTab) {
      secondTab.click();
      console.log('[Task App] กระตุ้นเหตุการณ์คลิกแล้ว');
    }
  }
};

console.log('[Task App] โหลดโมดูลแอปงานเสร็จ - เวอร์ชัน 2.0');