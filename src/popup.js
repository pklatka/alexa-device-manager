document.addEventListener("DOMContentLoaded", () => {
    const statusEl = document.getElementById("status");
    const deviceListEl = document.getElementById("device-list");
    const deleteAllBtn = document.getElementById("delete-all-btn");
    const refreshBtn = document.getElementById("refresh-btn");
    const spinnerEl = document.getElementById("spinner");

    let currentTabId = null;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        currentTabId = activeTab.id;

        if (!activeTab.url.includes("alexa.amazon.com")) {
            statusEl.innerHTML = `Please navigate to <a href="https://alexa.amazon.com" target="_blank">alexa.amazon.com</a> to manage your devices.`;
            statusEl.className = "status large error";
            return;
        }

        chrome.tabs.sendMessage(activeTab.id, { action: "checkSignIn" }, (response) => {
            if (response && response.signedIn === false) {
                statusEl.innerHTML = `Please sign in to your Amazon account to manage your devices.`;
                statusEl.className = "status large error";
                return;
            }

            refreshBtn.disabled = false;
            loadDevices();
        });
    });

    function loadDevices() {
        statusEl.innerText = "";
        statusEl.className = "status";
        spinnerEl.style.display = "flex";
        deviceListEl.innerHTML = "";
        deleteAllBtn.disabled = true;

        chrome.tabs.sendMessage(currentTabId, { action: "fetchDevices" }, (response) => {
            spinnerEl.style.display = "none";
            if (chrome.runtime.lastError || !response) {
                statusEl.innerHTML = `Error connecting. Try refreshing the page.`;
                statusEl.className = "status large error";
                return;
            }
            if (response.error) {
                statusEl.innerHTML = response.error;
                statusEl.className = "status large error";
                return;
            }

            const devices = response.devices;
            if (!devices || devices.length === 0) {
                statusEl.innerText = "No devices found.";
                statusEl.className = "status large info";
                return;
            }

            statusEl.className = "status";
            statusEl.innerText = `${devices.length} devices found.`
            renderDevices(devices, currentTabId);
            deleteAllBtn.disabled = false;
        });
    }

    refreshBtn.addEventListener("click", () => loadDevices());

    function renderDevices(devices, tabId) {
        deviceListEl.innerHTML = "";
        devices.forEach((device) => {
            const applianceId = device.legacyAppliance?.applianceId;
            const entityId = device.legacyAppliance?.entityId;
            const description = device.legacyAppliance?.friendlyDescription || "";
            if (!applianceId || !entityId) return;

            const card = document.createElement("div");
            card.className = "device-card";
            card.dataset.applianceId = applianceId;

            // Input field for renaming
            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.className = "device-name-input";
            nameInput.value = device.friendlyName || "Unknown Device";
            nameInput.disabled = true;

            const actionsContainer = document.createElement("div");
            actionsContainer.className = "actions";

            // Edit/Save Button
            const editBtn = document.createElement("button");
            editBtn.className = "action-btn edit-btn";
            editBtn.innerText = "Rename";

            // Delete Button
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "action-btn delete-btn";
            deleteBtn.innerText = "Delete";

            editBtn.onclick = () => {
                if (editBtn.innerText === "Rename") {
                    nameInput.disabled = false;
                    nameInput.focus();
                    editBtn.innerText = "Save";
                } else {
                    nameInput.disabled = true;
                    editBtn.innerText = "Saving...";
                    renameDeviceCall(entityId, nameInput.value, editBtn, tabId);
                }
            };

            deleteBtn.onclick = () => deleteDevice(applianceId, deleteBtn, card, tabId);

            actionsContainer.appendChild(editBtn);
            actionsContainer.appendChild(deleteBtn);

            const infoRow = document.createElement("div");
            infoRow.className = "device-info";

            if (description) {
                const descSpan = document.createElement("span");
                descSpan.className = "device-description";
                descSpan.textContent = description;
                infoRow.appendChild(descSpan);
            }

            const topRow = document.createElement("div");
            topRow.className = "device-top-row";
            topRow.appendChild(nameInput);
            topRow.appendChild(actionsContainer);

            card.appendChild(topRow);
            if (infoRow.children.length > 0) card.appendChild(infoRow);
            deviceListEl.appendChild(card);
        });
    }

    function renameDeviceCall(entityId, newName, btnElement, tabId) {
        chrome.tabs.sendMessage(tabId, { action: "renameDevice", id: entityId, name: newName }, (response) => {
            if (response && response.success) {
                btnElement.innerText = "Rename";
            } else {
                btnElement.innerText = "Failed";
                setTimeout(() => { btnElement.innerText = "Rename"; }, 2000);
            }
        });
    }

    function deleteDevice(applianceId, btnElement, cardElement, tabId) {
        return new Promise((resolve) => {
            btnElement.disabled = true;
            btnElement.innerText = "Deleting...";

            chrome.tabs.sendMessage(tabId, { action: "deleteDevice", id: applianceId }, (response) => {
                if (response && response.success) {
                    cardElement.style.opacity = "0.5";
                    cardElement.querySelector('.edit-btn').disabled = true;
                    cardElement.querySelector('.device-name-input').disabled = true;
                    btnElement.innerText = "Deleted";
                    resolve(true);
                } else {
                    btnElement.disabled = false;
                    btnElement.innerText = "Failed (Retry)";
                    resolve(false);
                }
            });
        });
    }

    function showConfirmDialog() {
        const dialog = document.getElementById("confirm-dialog");
        const cancelBtn = document.getElementById("dialog-cancel");
        const confirmBtn = document.getElementById("dialog-confirm");

        return new Promise((resolve) => {
            dialog.classList.add("visible");

            function cleanup(result) {
                dialog.classList.remove("visible");
                cancelBtn.removeEventListener("click", onCancel);
                confirmBtn.removeEventListener("click", onConfirm);
                resolve(result);
            }

            function onCancel() { cleanup(false); }
            function onConfirm() { cleanup(true); }

            cancelBtn.addEventListener("click", onCancel);
            confirmBtn.addEventListener("click", onConfirm);

            dialog.addEventListener("click", (e) => {
                if (e.target === dialog) cleanup(false);
            }, { once: true });
        });
    }

    deleteAllBtn.addEventListener("click", async () => {
        const isConfirmed = await showConfirmDialog();
        if (!isConfirmed) return;

        deleteAllBtn.disabled = true;
        refreshBtn.disabled = true;

        const progressContainer = document.getElementById("progress-container");
        const progressFill = document.getElementById("progress-fill");
        const progressCounter = document.getElementById("progress-counter");
        const progressLabel = document.getElementById("progress-label");

        // Swap device list for progress bar
        deviceListEl.style.display = "none";
        statusEl.style.display = "none";
        progressFill.style.width = "0%";
        progressFill.classList.remove("done", "warn");
        progressLabel.textContent = "Deleting devices\u2026";
        progressContainer.style.display = "flex";

        const cards = deviceListEl.querySelectorAll('.device-card');
        const total = cards.length;
        let completed = 0;
        let failed = 0;

        const updateProgress = () => {
            progressFill.style.width = `${(completed / total) * 100}%`;
            progressCounter.textContent = `${completed} / ${total} deleted` + (failed > 0 ? ` (${failed} failed)` : ``);
        };

        progressCounter.textContent = `0 / ${total} deleted`;

        const deletePromises = [...cards].map(async card => {
            const deleteBtn = card.querySelector('.delete-btn');
            if (!deleteBtn || deleteBtn.disabled) {
                completed++;
                updateProgress();
                return Promise.resolve();
            }

            let success = false;
            for (let attempt = 0; attempt < 10; attempt++) {
                success = await deleteDevice(card.dataset.applianceId, deleteBtn, card, currentTabId);
                if (success) break;
                // wait between attempts
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            completed++;
            if (!success) failed++;
            updateProgress();
        });

        await Promise.all(deletePromises);

        if (failed > 0) {
            progressFill.classList.add("warn");
            progressLabel.textContent = `Finished with ${failed} error${failed > 1 ? "s" : ""}`;
        } else {
            progressFill.classList.add("done");
            progressLabel.textContent = "All devices deleted!";
        }

        const progressRefreshBtn = document.getElementById("progress-refresh-btn");
        progressRefreshBtn.style.display = "inline-block";
        progressRefreshBtn.onclick = () => {
            progressContainer.style.display = "none";
            progressRefreshBtn.style.display = "none";
            deviceListEl.style.display = "";
            statusEl.style.display = "";
            refreshBtn.disabled = false;
            loadDevices();
        };
    });
});