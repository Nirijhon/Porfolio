/**
 * Single source of truth for all portfolio content.
 *
 * Exposed as a classic script (window.PortfolioData) rather than an ES module:
 * ES modules and import maps are blocked by CORS on the file:// protocol, which
 * would leave the page blank when index.html is opened by double-clicking it.
 */
(function () {
    'use strict';


    const PROFILE = {
        name: 'Nirijhon Kent Diaz',
        role: 'IT Staff & Command Center Specialist',
        location: 'Metro Manila, Philippines',
        email: 'nirijhonkentdiaz@gmail.com',
        phone: '+63 999 388 6698',
        phoneHref: 'tel:+639993886698',
        // Filename contains a space, so it is URL-encoded as %20.
        cv: 'DIAZ.NIRIJHON%20KENT.pdf',
        avatar: 'Profile.png',
        avatarAlt: 'Nirijhon Kent Diaz Profile',
        objective:
            'Results-driven and certified IT Specialist with extensive experience in Command Center CCTV surveillance operations, video management software (Dahua/Hikvision NVRs), hardware diagnostics, and network troubleshooting. Proven track record in maintaining continuous operational uptime, managing system logs, and developing custom desktop/web software utilities to streamline helpdesk ticketing and internal administrative workflows.',
        badges: [
            { icon: 'award', text: 'TESDA CSS NC II Certified' },
            { icon: 'graduation', text: 'BSCPE Graduate - Colegio De Montalban' },
            { icon: 'cctv', text: 'CCTV & Surveillance Ops' }
        ],
        metrics: [
            { label: 'Uptime Ops', value: '24/7 Monitoring', note: 'CCTV Command Center', accent: 'primary' },
            { label: 'Qualification', value: 'TESDA NC II', note: 'Systems Servicing', accent: 'accent' },
            { label: 'Alma Mater', value: 'BSCPE', note: 'Computer Engineering', accent: 'plain' },
            { label: 'Software', value: '4 Projects', note: 'Web & Desktop Apps', accent: 'primary' }
        ]
    };

    const CREDENTIALS = [
        {
            key: 'tesda',
            tag: 'National Certification',
            icon: 'shield',
            title: 'Computer Systems Servicing (CSS) NC II',
            meta: 'TESDA Assessment Certified',
            body:
                'Demonstrated technical competency in assembling computer hardware, installing and configuring desktop/server operating systems, setting up local area network (LAN) cabling, and diagnosing system hardware faults under national evaluation standards.',
            // TESDA certificate is a bitmap, so it opens in the zoomable lightbox.
            action: { label: 'View Certificate', kind: 'certificate' },
            // NG Maps CID is the identifier Google itself emits; tracking stripped.
            link: null,
            footer: ['Issuing Body: TESDA PH', 'Status: Verified Passer']
        },
        {
            key: 'cdm',
            tag: 'Academic Degree',
            icon: 'graduation',
            title: 'Colegio De Montalban (CDM)',
            meta: 'Graduate - Computer Engineering (BSCPE)',
            body:
                'Completed structured coursework in computer architecture and digital logic design, microcontrollers and embedded systems, industrial automation and control systems, sensor interfacing and instrumentation, networking and data communications and operating systems.',
            link: {
                label: 'View Location',
                href: 'https://www.google.com/maps/place/Colegio+de+Montalban/@14.7505611,121.1416665,1519m/data=!3m1!1e3!4m6!3m5!1s0x3397bbe8733338e5:0xc845d7b6001522e1!8m2!3d14.7509686!4d121.1420402!16s%2Fm%2F080f_k2'
            },
            footer: [
                'Location: Montalban San Jose Rodriguez Rizal, Philippines',
                'Status: Graduate'
            ]
        }
    ];

    const CERTIFICATE = {
        // Image format, so no URL encoding needed.
        file: 'NC.png',
        title: 'TESDA CSS NC II Certificate',
        alt: 'TESDA National Certificate II in Computer Systems Servicing awarded to Nirijhon Kent T. Diaz',
        naturalWidth: 556,
        naturalHeight: 783,
        minScale: 0.5,
        maxScale: 3,
        meta: 'Issued: Apr 30 2025  |  Valid until: Apr 25 2030  |  Cert. no. 25131202003535'
    };

    const SKILL_GROUPS = [
        {
            icon: 'server',
            title: 'Surveillance & Hardware Infrastructure',
            accent: 'primary',
            skills: [
                { name: 'CCTV Monitoring & NVR Admin (Dahua/Hikvision)', level: 95 },
                { name: 'Hardware Diagnostics & Maintenance', level: 90 },
                { name: 'Network Configuration & Cabling (CAT6/Crimping)', level: 85 }
            ]
        },
        {
            icon: 'code',
            title: 'Software Engineering & Utilities',
            accent: 'accent',
            skills: [
                { name: 'IT Ticketing & Expense Systems', level: 92 },
                { name: 'Desktop Software Applications (Electron)', level: 88 },
                { name: 'Web Application Development (HTML/CSS/JS)', level: 85 }
            ]
        }
    ];
    /**
     * Featured projects.
     *
     * `title` keeps the original "1. " style numbering verbatim; the UI renders
     * its own large section index, so `displayTitle` strips that prefix and the
     * overlay numbers the slides 01 / 02 / 03 / 04 instead.
     */
    const PROJECTS = [
        {
            title: '1. IT Helpdesk Ticketing Web App',
            displayTitle: 'IT Helpdesk Ticketing Web App',
            category: 'Web Application',
            img: 'ticketing.png',
            imgAlt: 'IT Helpdesk Ticketing Web App',
            /** Wide screenshots are cropped to a uniform card ratio in 3D. */
            cardAspect: 16 / 10,
            isPlaceholder: false,
            desc: 'An internal issue tracking and ticket management portal engineered for IT Staff and Command Center teams to log system faults, assign technical personnel, monitor SLAs, and streamline ticket dispatch.',
            summary:
                'A centralized internal ticketing platform engineered for IT staff to log hardware issues, manage SLA countdowns, assign technicians, and maintain operational logs.',
            features: [
                'Automated Ticket Priority Queues',
                'SLA Resolution Countdown Clock',
                'Technician Assignment & History',
                'Analytical Incident Report Engine'
            ],
            tags: ['HTML5', 'JavaScript', 'Tailwind CSS'],
            hasReceipt: false
        },
        {
            title: '2. Corporate Company Portal Website',
            displayTitle: 'Corporate Company Portal Website',
            category: 'Enterprise Portal',
            img: 'company%20website.png',
            imgAlt: 'Corporate Company Portal Website',
            cardAspect: 16 / 10,
            isPlaceholder: false,
            desc: 'A responsive corporate website featuring a store/branch locator, news feed ticker, service catalog, and an embedded dispatch request terminal for enterprise client inquiries.',
            summary:
                'An executive corporate website complete with company service overview, interactive locator map for branch offices, and an inquiry dispatch terminal.',
            features: [
                'Interactive Branch Store Locator',
                'Real-Time Corporate Announcements',
                'Fluid Responsive Mobile/Desktop UI',
                'Clean Search Engine Optimization'
            ],
            tags: ['Responsive Web', 'UI/UX', 'CSS Grid'],
            hasReceipt: false
        },
        {
            title: '3. Cross-Platform Sound Pad Desktop Application',
            displayTitle: 'Cross-Platform Sound Pad Application',
            category: 'Desktop Application',
            img: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80',
            imgAlt: 'Cross-Platform Sound Pad Desktop Application',
            cardAspect: 4 / 3,
            isPlaceholder: true,
            desc: 'A cross-platform desktop audio hotkey soundboard built for macOS and Windows, enabling low-latency sound triggers, Numpad keybindings, and broadcast alert queues.',
            summary:
                'A low-latency desktop sound hotkey application built for macOS and Windows, supporting instant soundboard playback, keyboard mapping, and sound queues.',
            features: [
                'Numpad & Keyboard Hotkey Mapping',
                'Dual-Track Audio Playback Engine',
                'Custom Sound File Import Queue',
                'Native macOS & Windows Packaging'
            ],
            tags: ['Electron', 'macOS / Windows', 'Web Audio API'],
            hasReceipt: false
        },
        {
            title: '4. Expense Tracker & Thermal Receipt Generator',
            displayTitle: 'Expense Tracker & Thermal Receipt Generator',
            category: 'Financial & Print Utility',
            img: 'Expens%20tracker.png',
            imgAlt: 'Expense Tracker with Printable Receipt System',
            cardAspect: 16 / 10,
            isPlaceholder: false,
            desc: 'A financial logging web application equipped with automated category expense breakdowns and a thermal paper print generator for official documentation.',
            summary:
                'A financial auditing web utility with live balance calculation and a thermal receipt generator capable of physical receipt printing via standard browsers.',
            features: [
                'Automated Financial Calculations',
                '80mm Thermal Receipt Print Engine',
                'Exportable Summary Logs & Reports',
                'Instant Real-Time Recalculations'
            ],
            tags: ['Thermal Print CSS', 'JavaScript', 'Finance Engine'],
            // Only the expense tool renders the printable receipt demo.
            hasReceipt: true
        }
    ];

    /** 80mm thermal receipt demo, shown inside the project inspector for project 4. */
    const RECEIPT = {
        business: 'Command Center IT Services',
        subtitle: 'Official Service Receipt',
        number: '2026-8891',
        date: 'Oct 2026',
        lines: [
            { label: 'Dahua NVR Config (4 Ch)', amount: '₱ 2,500.00' },
            { label: 'CAT6 Patch Crimping', amount: '₱ 1,200.00' },
            { label: 'PC OS Drivers Setup', amount: '₱ 1,800.00' }
        ],
        total: '₱ 5,500.00',
        footer: '*** THANK YOU FOR YOUR BUSINESS ***'
    };

    const CONTACT = {
        eyebrow: 'Dispatch Inquiry',
        title: 'Contact Nirijhon Diaz',
        body:
            'Inquire regarding Command Center operations roles, IT Staff vacancies, or software deployment consultations.',
        success: 'Message transmitted successfully. Nirijhon will respond shortly!'
    };

    const NAV = [
        { id: 'intro', label: 'Intro' },
        { id: 'credentials', label: 'Credentials' },
        { id: 'skills', label: 'Skills' },
        { id: 'work', label: 'Work' },
        { id: 'contact', label: 'Contact' }
    ];

    window.PortfolioData = {
        PROFILE,
        CREDENTIALS,
        CERTIFICATE,
        SKILL_GROUPS,
        PROJECTS,
        RECEIPT,
        CONTACT,
        NAV
    };
})();
