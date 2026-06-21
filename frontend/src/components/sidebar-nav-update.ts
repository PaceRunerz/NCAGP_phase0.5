// Add these new items to ROLE_NAV in Sidebar.tsx
// Replace the existing ROLE_NAV object with this one

export const ROLE_NAV_UPDATE = `
const ROLE_NAV: Record<string, { section: string; items: { href: string; label: string; icon: any }[] }[]> = {

  NIC_ADMIN: [
    { section: 'Intelligence', items: [
      { href: '/dashboard',     label: 'National Heatmap',   icon: LayoutDashboard },
      { href: '/intelligence',  label: 'AI Intelligence',    icon: Brain            },
      { href: '/findings',      label: 'All Findings',        icon: AlertTriangle    },       
    ]}, 
    { section: 'Audit Management', items: [
      { href: '/audits',        label: 'Audit Lifecycle',    icon: ClipboardList    },
      { href: '/tasks',         label: 'Remediation Tasks',  icon: CheckSquare      },
      { href: '/vendors',       label: 'Vendor Scorecards',  icon: Star             },
    ]},
    { section: 'Evidence & Ledger', items: [
      { href: '/evidence',      label: 'Evidence Portal',   icon: FileText         },
      { href: '/ledger',        label: 'Audit Ledger',       icon: BookOpen         },
    ]},
    { section: 'Registry', items: [
      { href: '/organizations', label: 'Organizations',      icon: Building2        },
      { href: '/assets',        label: 'Asset Register',     icon: Server           },
      { href: '/controls',      label: 'Control Library',    icon: Shield           },
    ]},
    { section: 'Admin', items: [
      { href: '/settings',      label: 'Settings & MFA',     icon: Settings         },
    ]},
  ],

  DEPT_CISO: [
    { section: 'My Department', items: [
      { href: '/dept-dashboard',label: 'CISO Overview',      icon: BarChart3        },
      { href: '/findings',      label: 'Dept Findings',      icon: AlertTriangle    },
      { href: '/intelligence',  label: 'Risk Intelligence',  icon: Brain            },
    ]},
    { section: 'Audit & Tasks', items: [
      { href: '/audits',        label: 'Audit Lifecycle',    icon: ClipboardList    },
      { href: '/tasks',         label: 'Remediation Tasks',  icon: CheckSquare      },
    ]},
    { section: 'Operations', items: [
      { href: '/evidence',      label: 'Evidence Portal',   icon: FileText         },
      { href: '/assets',        label: 'Asset Register',     icon: Server           },
      { href: '/controls',      label: 'Control Library',    icon: Shield           },
    ]},
    { section: 'Account', items: [
      { href: '/settings',      label: 'Settings & MFA',     icon: Settings         },
    ]},
  ],

  DEPT_SECURITY: [
    { section: 'My Work', items: [
      { href: '/dept-dashboard',label: 'Security Ops',       icon: Shield           },
      { href: '/findings',      label: 'Dept Findings',      icon: AlertTriangle    },
      { href: '/tasks',         label: 'My Tasks',           icon: CheckSquare      },
    ]},
    { section: 'Actions', items: [
      { href: '/evidence',      label: 'Upload Evidence',   icon: Upload           },
      { href: '/assets',        label: 'Asset Register',     icon: Server           },
    ]},
    { section: 'Account', items: [
      { href: '/settings',      label: 'Settings & MFA',     icon: Settings         },
    ]},
  ],

  VENDOR_ADMIN: [
    { section: 'My Audits', items: [
      { href: '/audit-dashboard',label: 'Audit Overview',   icon: ClipboardList    },
      { href: '/findings',       label: 'Submit Findings',   icon: AlertTriangle    },
      { href: '/audits',         label: 'Audit Lifecycle',   icon: BookOpen         },
    ]},
    { section: 'Validate', items: [
      { href: '/evidence',       label: 'Review Evidence',  icon: FileText         },
      { href: '/controls',       label: 'Control Library',   icon: Shield           },
    ]},
    { section: 'Account', items: [
      { href: '/settings',       label: 'Settings & MFA',    icon: Settings         },
    ]},
  ],

  AUDITOR: [
    { section: 'My Work', items: [
      { href: '/audit-dashboard',label: 'Audit Workspace',  icon: Search           },
      { href: '/findings',       label: 'Findings',          icon: AlertTriangle    },
      { href: '/tasks',          label: 'My Tasks',          icon: CheckSquare      },
    ]},
    { section: 'Reference', items: [
      { href: '/evidence',       label: 'Review Evidence',  icon: FileText         },
      { href: '/controls',       label: 'Control Library',   icon: Shield           },
    ]},
    { section: 'Account', items: [
      { href: '/settings',       label: 'Settings & MFA',    icon: Settings         },
    ]},
  ],

  REVIEWER: [
    { section: 'Review', items: [
      { href: '/review-dashboard',label: 'Review Dashboard',icon: BarChart3        },
      { href: '/findings',        label: 'View Findings',    icon: AlertTriangle    },
      { href: '/intelligence',    label: 'Intelligence',     icon: Brain            },
    ]},
    { section: 'Audit Trail', items: [
      { href: '/ledger',          label: 'Audit Ledger',     icon: BookOpen         },
      { href: '/vendors',         label: 'Vendor Scorecards',icon: Star             },
    ]},
    { section: 'Account', items: [
      { href: '/settings',        label: 'Settings',         icon: Settings         },
    ]},
  ],

  OBSERVER: [
    { section: 'View Only', items: [
      { href: '/review-dashboard',label: 'Observer View',    icon: Eye              },
      { href: '/findings',        label: 'View Findings',    icon: AlertTriangle    },
    ]},
  ],
};
`;
