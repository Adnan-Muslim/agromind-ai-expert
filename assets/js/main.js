/**
 * main.js — Agro AI shared behavior
 *
 * Loads on every page. Handles: Lucide icon init, dark mode toggle,
 * active nav link detection, hamburger menu, footer year, Learning Center
 * category filtering, contact form validation, and smooth scroll.
 *
 * NOTE — Theme flash prevention:
 *   An inline <script> in each page's <head> already reads
 *   localStorage.getItem('agroai-theme') and sets data-theme synchronously
 *   before CSS renders. This file handles everything that runs after DOM load.
 */

document.addEventListener('DOMContentLoaded', function () {

  // ─────────────────────────────────────────────
  // Lucide icon initialization
  // ─────────────────────────────────────────────
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // ─────────────────────────────────────────────
  // Dark mode toggle
  // ─────────────────────────────────────────────
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const themeIcon = document.getElementById('theme-icon');

  /**
   * Sync the toggle button's aria-label and icon to match the current theme.
   * @param {string} theme - 'light' or 'dark'
   */
  function updateToggleUI(theme) {
    if (!darkModeToggle || !themeIcon) return;

    if (theme === 'dark') {
      darkModeToggle.setAttribute('aria-label', 'Switch to light mode');
      themeIcon.setAttribute('data-lucide', 'sun');
    } else {
      darkModeToggle.setAttribute('aria-label', 'Switch to dark mode');
      themeIcon.setAttribute('data-lucide', 'moon');
    }

    // Re-initialize only the theme icon element so Lucide renders the new SVG
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ root: themeIcon.parentElement || document.body });
    }
  }

  // Apply button UI to match whatever theme is already active on load
  const initialTheme = document.documentElement.getAttribute('data-theme') || 'light';
  updateToggleUI(initialTheme);

  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = current === 'dark' ? 'light' : 'dark';

      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('agroai-theme', newTheme);
      updateToggleUI(newTheme);
    });
  }

  // ─────────────────────────────────────────────
  // Active navigation link detection
  // ─────────────────────────────────────────────
  const pathname = window.location.pathname;
  const currentFile = pathname.split('/').pop() || 'index.html';

  document.querySelectorAll('.nav-link').forEach(function (link) {
    // Remove active class from all links first
    link.classList.remove('nav-link--active');

    const linkHref = link.getAttribute('href');
    if (linkHref === currentFile) {
      link.classList.add('nav-link--active');
    }
  });

  // ─────────────────────────────────────────────
  // Hamburger menu
  // ─────────────────────────────────────────────
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navMenu = document.getElementById('nav-menu');

  /**
   * Open the mobile nav menu, move focus to the first nav link.
   */
  function openMenu() {
    if (!navMenu || !hamburgerBtn) return;
    navMenu.classList.add('nav-menu--open');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    hamburgerBtn.setAttribute('aria-label', 'Close navigation menu');

    // Move focus to the first nav link inside the menu
    const firstLink = navMenu.querySelector('.nav-link');
    if (firstLink) firstLink.focus();
  }

  /**
   * Close the mobile nav menu, restore focus to the hamburger button.
   */
  function closeMenu() {
    if (!navMenu || !hamburgerBtn) return;
    navMenu.classList.remove('nav-menu--open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    hamburgerBtn.setAttribute('aria-label', 'Open navigation menu');
    hamburgerBtn.focus();
  }

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', function () {
      const isOpen = navMenu && navMenu.classList.contains('nav-menu--open');
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });
  }

  // Close menu on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && navMenu && navMenu.classList.contains('nav-menu--open')) {
      closeMenu();
    }
  });

  // Close menu when clicking outside the navbar
  document.addEventListener('click', function (e) {
    if (!navMenu || !navMenu.classList.contains('nav-menu--open')) return;

    const navbar = document.querySelector('.navbar');
    if (navbar && !navbar.contains(e.target)) {
      closeMenu();
    }
  });

  // ─────────────────────────────────────────────
  // Copyright year in footer
  // ─────────────────────────────────────────────
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ─────────────────────────────────────────────
  // Learning Center category filtering
  // Only runs on learning.html (requires .category-tablist)
  // ─────────────────────────────────────────────
  const categoryTablist = document.querySelector('.category-tablist');

  if (categoryTablist) {
    const tabs = Array.from(document.querySelectorAll('.category-tab'));
    const cards = Array.from(document.querySelectorAll('.content-card'));

    /**
     * Filter content cards to show only those matching the given category.
     * @param {string} selectedCategory - The data-category value to show
     */
    function filterByCategory(selectedCategory) {
      // Update tab ARIA states
      tabs.forEach(function (tab) {
        const isSelected = tab.dataset.category === selectedCategory;
        tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });

      // Show / hide cards
      cards.forEach(function (card) {
        if (card.dataset.category === selectedCategory) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    }

    // Attach click handlers to each tab
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        filterByCategory(tab.dataset.category);
      });
    });

    // On load: activate the first tab
    if (tabs.length > 0) {
      tabs[0].click();
    }
  }

  // ─────────────────────────────────────────────
  // Contact form validation
  // Only runs on contact.html (requires #contact-form)
  // ─────────────────────────────────────────────
  const contactForm = document.getElementById('contact-form');

  if (contactForm) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      // Grab field values
      const nameField    = document.getElementById('name');
      const emailField   = document.getElementById('email');
      const messageField = document.getElementById('message');

      const nameError    = document.getElementById('name-error');
      const emailError   = document.getElementById('email-error');
      const messageError = document.getElementById('message-error');
      const successBox   = document.getElementById('contact-success');

      // Clear all existing error messages first
      if (nameError)    nameError.textContent    = '';
      if (emailError)   emailError.textContent   = '';
      if (messageError) messageError.textContent = '';

      let hasError = false;
      let firstInvalidField = null;

      // Validate Name — must be non-empty
      if (nameField && nameField.value.trim() === '') {
        if (nameError) nameError.textContent = 'Name is required';
        hasError = true;
        if (!firstInvalidField) firstInvalidField = nameField;
      }

      // Validate Email — must be non-empty and match regex
      if (emailField) {
        if (emailField.value.trim() === '') {
          if (emailError) emailError.textContent = 'Email is required';
          hasError = true;
          if (!firstInvalidField) firstInvalidField = emailField;
        } else if (!emailRegex.test(emailField.value.trim())) {
          if (emailError) emailError.textContent = 'Please enter a valid email address';
          hasError = true;
          if (!firstInvalidField) firstInvalidField = emailField;
        }
      }

      // Validate Message — must be non-empty
      if (messageField && messageField.value.trim() === '') {
        if (messageError) messageError.textContent = 'Message is required';
        hasError = true;
        if (!firstInvalidField) firstInvalidField = messageField;
      }

      if (hasError) {
        // Focus the first field with an error
        if (firstInvalidField) firstInvalidField.focus();
        return;
      }

      // Validation passed — show success message, reset form
      if (successBox) {
        successBox.removeAttribute('hidden');

        // Hide the success message again after 5 seconds
        setTimeout(function () {
          successBox.setAttribute('hidden', '');
        }, 5000);
      }

      contactForm.reset();
    });
  }

  // ─────────────────────────────────────────────
  // Smooth scroll for anchor links
  // ─────────────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

}); // end DOMContentLoaded
