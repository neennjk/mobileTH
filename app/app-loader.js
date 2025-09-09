/**
 * App Loader - โหลดแอป
 * รับประกันว่าทุกโมดูลแอปมือถือโหลดตามลำดับที่ถูกต้อง
 */

class AppLoader {
    constructor() {
        this.loadedModules = new Set();
        this.loadingModules = new Set();
        this.moduleLoadQueue = [];

        console.log('[App Loader] โหลดแอปถูกสร้างแล้ว');
    }

    // โหลดโมดูล
    async loadModule(moduleName, moduleUrl, dependencies = []) {
        try {
            console.log(`[App Loader] เริ่มโหลดโมดูล: ${moduleName}`);

            // หากโหลดแล้ว ให้คืนค่าโดยตรง
            if (this.loadedModules.has(moduleName)) {
                console.log(`[App Loader] โมดูล ${moduleName} โหลดแล้ว`);
                return true;
            }

            // หากกำลังโหลด ให้รอให้เสร็จ
            if (this.loadingModules.has(moduleName)) {
                console.log(`[App Loader] โมดูล ${moduleName} กำลังโหลด รอให้เสร็จ...`);
                return await this.waitForModule(moduleName);
            }

            // ทำเครื่องหมายว่ากำลังโหลด
            this.loadingModules.add(moduleName);

            // ตรวจสอบการพึ่งพา
            for (const dep of dependencies) {
                if (!this.loadedModules.has(dep)) {
                    console.log(`[App Loader] โมดูล ${moduleName} พึ่งพา ${dep} โหลดการพึ่งพาก่อน`);
                    await this.loadModule(dep, this.getModuleUrl(dep));
                }
            }

            // โหลดโมดูล
            await this.loadScript(moduleUrl);

            // ทำเครื่องหมายว่าโหลดแล้ว
            this.loadedModules.add(moduleName);
            this.loadingModules.delete(moduleName);

            console.log(`[App Loader] ✅ โมดูล ${moduleName} โหลดเสร็จ`);
            return true;

        } catch (error) {
            console.error(`[App Loader] โหลดโมดูล ${moduleName} ล้มเหลว:`, error);
            this.loadingModules.delete(moduleName);
            return false;
        }
    }

    // รอให้โมดูลโหลดเสร็จ
    async waitForModule(moduleName, timeout = 10000) {
        const startTime = Date.now();

        while (this.loadingModules.has(moduleName)) {
            if (Date.now() - startTime > timeout) {
                throw new Error(`รอโมดูล ${moduleName} หมดเวลา`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return this.loadedModules.has(moduleName);
    }

    // โหลดสคริปต์
    async loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // ดึง URL โมดูล
    getModuleUrl(moduleName) {
        const baseUrl = 'scripts/extensions/third-party/mobile/app/';
        const moduleUrls = {
            'context-monitor': baseUrl + 'context-monitor.js',
            'friend-renderer': baseUrl + 'friend-renderer.js',
            'message-sender': baseUrl + 'message-sender.js',
            'message-app': baseUrl + 'message-app.js',
            'real-time-sync': baseUrl + 'real-time-sync.js'
        };

        return moduleUrls[moduleName] || `${baseUrl}${moduleName}.js`;
    }

    // โหลดโมดูลจำนวนมาก
    async loadModules(modules) {
        const results = [];

        for (const module of modules) {
            const result = await this.loadModule(
                module.name,
                module.url || this.getModuleUrl(module.name),
                module.dependencies || []
            );
            results.push({ name: module.name, success: result });
        }

        return results;
    }

    // ดึงสถานะโหลด
    getLoadStatus() {
        return {
            loadedModules: Array.from(this.loadedModules),
            loadingModules: Array.from(this.loadingModules),
            totalLoaded: this.loadedModules.size,
            totalLoading: this.loadingModules.size
        };
    }
}

// สร้างอินสแตนซ์โหลดแอปทั่วไป
if (typeof window.appLoader === 'undefined') {
    window.appLoader = new AppLoader();
}

// โหลดโมดูลแอปมือถือโดยอัตโนมัติ
async function loadMobileAppModules() {
    try {
        console.log('[App Loader] 🚀 เริ่มโหลดโมดูลแอปมือถือ');

        const modules = [
            {
                name: 'context-monitor',
                dependencies: []
            },
            {
                name: 'friend-renderer',
                dependencies: ['context-monitor']
            },
            {
                name: 'message-sender',
                dependencies: ['context-monitor']
            },
            {
                name: 'message-app',
                dependencies: ['context-monitor', 'friend-renderer', 'message-sender']
            },
            {
                name: 'real-time-sync',
                dependencies: ['context-monitor', 'friend-renderer', 'message-app']
            }
        ];

        const results = await window.appLoader.loadModules(modules);

        // ตรวจสอบผลลัพธ์โหลด
        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
            console.error('[App Loader] โมดูลบางส่วนโหลดล้มเหลว:', failed);
        }

        const succeeded = results.filter(r => r.success);
        console.log(`[App Loader] ✅ โหลดสำเร็จ ${succeeded.length}/${results.length} โมดูล`);

        // เริ่มซิงค์แบบเรียลไทม์
        setTimeout(() => {
            if (window.realTimeSync && !window.realTimeSync.isRunning) {
                console.log('[App Loader] 🔄 เริ่มซิงค์แบบเรียลไทม์');
                window.realTimeSync.start();
            }
        }, 1000);

    } catch (error) {
        console.error('[App Loader] โหลดโมดูลแอปมือถือล้มเหลว:', error);
    }
}

// ตรวจสอบว่าอยู่ในสภาพแวดล้อมมือถือหรือไม่
function isMobileEnvironment() {
    return window.location.pathname.includes('mobile') ||
           document.querySelector('[data-app]') !== null ||
           window.mobilePhone !== undefined;
}

// โหลดอัตโนมัติแบบล่าช้า
setTimeout(() => {
    if (isMobileEnvironment()) {
        loadMobileAppModules();
    }
}, 1000);

console.log('[App Loader] โมดูลโหลดแอปโหลดเสร็จ');