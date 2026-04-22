/**
 * PmPopup - Lightweight tooltip/popup implementation with no external dependencies.
 * Drop-in replacement for the Tippy.js usage in this extension.
 *
 * Positioning uses plain viewport arithmetic — sufficient for the flat page
 * layout of popmundo.com.
 */

// Inject base popup styles once per page
(function () {
    if (document.getElementById('pm-popup-base-styles')) return;
    const style = document.createElement('style');
    style.id = 'pm-popup-base-styles';
    style.textContent = `
        .pm-popup {
            border-radius: 4px;
            word-break: break-word;
            outline: 0;
            background-color: #333;
        }
        .pm-popup-content {
            padding: 5px 9px;
            position: relative;
            z-index: 1;
        }
        .pm-popup[data-theme='transparent'] { background-color: transparent; }
        .pm-popup[data-theme='retro']       { background-color: white; }
        .pm-popup[data-theme='retro'] .pm-popup-content { padding: 2px 2px; }
        .pm-popup[data-theme='dark']        { background-color: #222; }
        .pm-popup[data-theme='default']     { background-color: #D1D1D1; }
    `;
    document.head.appendChild(style);
})();

/**
 * PmPopup mirrors the subset of the Tippy.js instance API used by this extension.
 *
 * Supported options (match Tippy names):
 *   content, allowHTML, followCursor, maxWidth, theme,
 *   interactive, placement,
 *   onCreate(instance), onShow(instance), onHidden(instance)
 *
 * Instance properties exposed to lifecycle hooks:
 *   instance.reference       – the anchor DOM element
 *   instance.setContent(html)
 *   instance.setProps({theme})
 *   instance._isFetching, instance._src, instance._error  – managed by callers
 */
class PmPopup {
    constructor(selector, options) {
        this._options = Object.assign({
            content: '',
            allowHTML: true,
            followCursor: false,
            maxWidth: 500,
            theme: '',
            interactive: false,
            placement: 'bottom',
            onCreate: null,
            onShow: null,
            onHidden: null,
        }, options);

        document.querySelectorAll(selector).forEach(el => this._init(el));
    }

    // Compute and apply popup position. Uses requestAnimationFrame internally
    // to ensure the browser has rendered the popup before measuring its size.
    _place(popupEl, reference, getMousePos) {
        const GAP = 12; // gap between cursor/element and popup edge
        const PAD = 8;  // minimum distance from viewport edge
        const followCursor = this._options.followCursor;
        const placement    = this._options.placement || 'bottom';

        requestAnimationFrame(() => {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const pw = popupEl.offsetWidth;
            const ph = popupEl.offsetHeight;

            let x, y;

            if (followCursor) {
                const { x: mx, y: my } = getMousePos();
                // Prefer right of cursor; flip left if it would overflow
                x = (mx + GAP + pw > vw - PAD) ? mx - pw - GAP : mx + GAP;
                // Prefer below cursor; flip above if it would overflow
                y = (my + GAP + ph > vh - PAD) ? my - ph - GAP : my + GAP;
            } else {
                const rect = reference.getBoundingClientRect();

                if (placement.startsWith('top')) {
                    y = rect.top - ph - GAP;
                    if (y < PAD) y = rect.bottom + GAP; // flip to bottom
                } else {
                    // bottom / bottom-start / bottom-end (default)
                    y = rect.bottom + GAP;
                    if (y + ph > vh - PAD) y = rect.top - ph - GAP; // flip to top
                }

                x = placement.endsWith('end') ? rect.right - pw : rect.left;
                if (x + pw > vw - PAD) x = vw - pw - PAD;
                if (x < PAD) x = PAD;
            }

            // Final clamp — keeps popup fully inside the viewport in all cases
            x = Math.max(PAD, Math.min(x, vw - pw - PAD));
            y = Math.max(PAD, Math.min(y, vh - ph - PAD));

            popupEl.style.left = `${x}px`;
            popupEl.style.top  = `${y}px`;
        });
    }

    _init(reference) {
        const opts = this._options;

        // --- Build popup DOM ---
        const popupEl = document.createElement('div');
        popupEl.className = 'pm-popup';
        if (opts.theme) popupEl.setAttribute('data-theme', opts.theme);
        popupEl.style.cssText =
            'position:fixed;z-index:9999;display:none;' +
            `max-width:${opts.maxWidth}px;` +
            `pointer-events:${opts.interactive ? 'auto' : 'none'};` +
            'box-sizing:border-box;';

        const contentEl = document.createElement('div');
        contentEl.className = 'pm-popup-content';
        popupEl.appendChild(contentEl);
        document.body.appendChild(popupEl);

        // Mutable mouse position shared across closures
        let mouseX = 0, mouseY = 0;
        const getMousePos = () => ({ x: mouseX, y: mouseY });

        const reposition = () => this._place(popupEl, reference, getMousePos);

        // --- Instance object (mirrors Tippy's instance API) ---
        const instance = {
            reference,
            _isFetching: false,
            _src: null,
            _error: null,
            setContent: (html) => {
                if (opts.allowHTML) {
                    contentEl.innerHTML = html;
                } else {
                    contentEl.textContent = html;
                }
                // Re-position after content size changes (e.g. fetch completes)
                if (popupEl.style.display !== 'none') reposition();
            },
            setProps: (props) => {
                if (props.theme !== undefined) {
                    if (props.theme) {
                        popupEl.setAttribute('data-theme', props.theme);
                    } else {
                        popupEl.removeAttribute('data-theme');
                    }
                }
            },
        };

        instance.setContent(opts.content);
        if (opts.onCreate) opts.onCreate(instance);

        // --- Show / hide ---
        const show = () => {
            if (opts.onShow && opts.onShow(instance) === false) return;
            popupEl.style.display = 'block';
            reposition(); // rAF inside _place handles layout timing
        };

        const hide = () => {
            if (popupEl.style.display === 'none') return;
            popupEl.style.display = 'none';
            if (opts.onHidden) opts.onHidden(instance);
        };

        // --- Event listeners ---
        reference.addEventListener('mouseenter', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            show();
        });

        if (opts.followCursor) {
            reference.addEventListener('mousemove', (e) => {
                mouseX = e.clientX;
                mouseY = e.clientY;
                if (popupEl.style.display !== 'none') reposition();
            });
        }

        reference.addEventListener('mouseleave', (e) => {
            if (opts.interactive && e.relatedTarget && popupEl.contains(e.relatedTarget)) return;
            hide();
        });

        if (opts.interactive) {
            popupEl.addEventListener('mouseleave', (e) => {
                if (!reference.contains(e.relatedTarget)) hide();
            });
        }
    }
}
