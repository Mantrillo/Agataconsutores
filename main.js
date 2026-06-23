/**
 * AGATA. - Interactions & Contact Form Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initContactForm();
  initScrollAnimations();
});

/**
 * Mobile Navigation Toggle
 */
function initMobileNav() {
  const toggleBtn = document.getElementById('mobile-nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (!toggleBtn || !navMenu) return;

  const toggleMenu = () => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleBtn.setAttribute('aria-expanded', !isExpanded);
    navMenu.classList.toggle('is-active');
  };

  toggleBtn.addEventListener('click', toggleMenu);

  // Close menu when a link is clicked
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      toggleBtn.setAttribute('aria-expanded', 'false');
      navMenu.classList.remove('is-active');
    });
  });
}

/**
 * Contact Form Submission with Formspree (AJAX)
 */
function initContactForm() {
  const form = document.getElementById('contact-form');
  const statusMessage = document.getElementById('form-status');
  const submitBtn = document.getElementById('btn-submit');

  if (!form || !statusMessage || !submitBtn) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = new FormData(form);
    
    // Set loading state
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'ENVIANDO...';
    statusMessage.textContent = '';
    statusMessage.className = 'form-status-message';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        // Success: stoic, quiet, no exclamation marks
        statusMessage.textContent = 'Mensaje recibido. Nos pondremos en contacto.';
        statusMessage.classList.add('success');
        form.reset();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar el formulario.');
      }
    } catch (error) {
      // Error: simple and direct
      statusMessage.textContent = 'Error al enviar. Intente de nuevo.';
      statusMessage.classList.add('error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

/**
 * Scroll Animations using Intersection Observer
 */
function initScrollAnimations() {
  // Fade-in animation for sections
  const sections = document.querySelectorAll('.section-container, .hero-section');
  
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        // Unobserve to run animation once
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  sections.forEach(section => {
    section.classList.add('scroll-animate');
    observer.observe(section);
  });
}
