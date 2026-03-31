/**
 * Applies chrome.i18n translations to all elements with data-i18n* attributes.
 * Must be called before Bootstrap tooltip initialization.
 */
function localizeUI() {
    // data-i18n: set textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const msg = chrome.i18n.getMessage(el.dataset.i18n);
        if (msg) el.textContent = msg;
    });

    // data-i18n-title: set the title attribute (used by Bootstrap Tooltip)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const msg = chrome.i18n.getMessage(el.dataset.i18nTitle);
        if (msg) el.title = msg;
    });

    // data-i18n-placeholder: set the placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const msg = chrome.i18n.getMessage(el.dataset.i18nPlaceholder);
        if (msg) el.placeholder = msg;
    });

    // Page title lives in <title> which uses textContent too
    const titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) {
        const msg = chrome.i18n.getMessage(titleEl.dataset.i18n);
        if (msg) document.title = msg;
    }
}

document.addEventListener('DOMContentLoaded', function () {

    // ── Localize UI before tooltip init so title attributes are already translated ──
    localizeUI();

    // ── Tab switching ──
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const sections = document.querySelectorAll('.tab-content-section');

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.dataset.tab;

            sections.forEach(s => s.classList.add('d-none'));
            document.getElementById(targetId).classList.remove('d-none');

            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // ── Bootstrap Tooltips ──
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));

    // ── Show Developer tab in development builds or when ?debug=true is in the URL ──
    const debugParam = new URLSearchParams(window.location.search).get('debug') === 'true';
    debugger;
    chrome.storage.local.get('install_type', ({ install_type }) => {
        if (install_type === 'development' || debugParam) {
            document.getElementById('nav-developer').classList.remove('d-none');
        }
    });
});
