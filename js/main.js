document.addEventListener('DOMContentLoaded', () => {
    // Mobile navigation toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');

            // Toggle hamburger icon if using textual or simple icon
            if (navLinks.classList.contains('active')) {
                mobileMenuBtn.innerHTML = '✕';
            } else {
                mobileMenuBtn.innerHTML = '☰';
            }
        });
    }

    // Active link highlighting based on current path
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navItems = document.querySelectorAll('.nav-links a');

    navItems.forEach(item => {
        const itemPath = item.getAttribute('href');
        let isMatch = false;
        if (itemPath === currentPath) {
            isMatch = true;
        } else if (itemPath === 'engineering-specs.html' && currentPath.startsWith('engineering-')) {
            isMatch = true;
        }

        if (isMatch) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Intersection Observer for Scroll Animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Stop observing once revealed
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal');
    revealElements.forEach(el => revealObserver.observe(el));

    // Scroll to Top Button functionality
    const scrollTopBtn = document.querySelector('.scroll-top');

    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                scrollTopBtn.classList.add('show');
            } else {
                scrollTopBtn.classList.remove('show');
            }
        });

        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Rotating Gripper Background Animation
    const gripperContainer = document.querySelector('.gripper-bg-container');
    const gripperImg = document.querySelector('.gripper-bg-img');

    if (gripperContainer && gripperImg) {
        let ticked = false;

        const updateGripper = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            
            // Calculate scroll percentage (0 to 1)
            const scrollPercent = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
            
            // Rotate left (counter-clockwise) up to 120 degrees
            const rotation = scrollPercent * -120;
            gripperImg.style.transform = `rotate(${rotation}deg)`;

            // Fade in the gripper container after scrolling past 150px
            // Full opacity when scrolled past 600px
            const fadeStart = 150;
            const fadeEnd = 600;
            
            if (scrollTop > fadeStart) {
                const opacity = Math.min(1, (scrollTop - fadeStart) / (fadeEnd - fadeStart));
                gripperContainer.style.opacity = opacity;
            } else {
                gripperContainer.style.opacity = 0;
            }

            ticked = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticked) {
                window.requestAnimationFrame(updateGripper);
                ticked = true;
            }
        });

        // Initialize on load to set correct initial state
        updateGripper();
    }
});
