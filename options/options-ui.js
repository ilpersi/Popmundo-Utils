document.addEventListener('DOMContentLoaded', function () {

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
});
