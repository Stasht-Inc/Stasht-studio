import { useState, useEffect } from "react";
import { Crown, CreditCard, FileText, TrendingUp, Zap } from 'lucide-react';

interface BillingNavProps {
  isStacked: boolean;
  onToggleExpansion: () => void;
  canToggle: boolean;
}

interface BillingSection {
  id: string;
  name: string;
  icon: React.ReactNode;
}

export default function BillingNav({
  isStacked,
  onToggleExpansion,
  canToggle
}: BillingNavProps) {
  const [activeSection, setActiveSection] = useState('current-plan');

  // Scroll-based section detection using Intersection Observer
  useEffect(() => {
    let observer: IntersectionObserver | null = null;

    const setupObserver = () => {
      const sectionIds = ['current-plan', 'payment-methods', 'billing-history', 'ai-credit-history', 'quick-stats'];
      const sectionElements = sectionIds.map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[];

      if (sectionElements.length === 0) {
        setTimeout(setupObserver, 100);
        return;
      }

      const observerCallback = (entries: IntersectionObserverEntry[]) => {
        const visibleEntries = entries.filter(entry => entry.intersectionRatio > 0);

        if (visibleEntries.length === 0) return;

        let mostVisible = visibleEntries[0];
        for (const entry of visibleEntries) {
          if (entry.intersectionRatio > mostVisible.intersectionRatio) {
            mostVisible = entry;
          }
        }

        const sectionId = mostVisible.target.id;
        setActiveSection(prev => {
          if (prev !== sectionId) {
            return sectionId;
          }
          return prev;
        });
      };

      observer = new IntersectionObserver(observerCallback, {
        root: null,
        rootMargin: '-20% 0px -40% 0px',
        threshold: [0, 0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1]
      });

      sectionElements.forEach(element => {
        observer!.observe(element);
      });
    };

    setTimeout(setupObserver, 100);

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  const sections: BillingSection[] = [
    {
      id: 'current-plan',
      name: 'Current Plan',
      icon: <Crown className="w-full h-full" />
    },
    {
      id: 'payment-methods',
      name: 'Payment Methods',
      icon: <CreditCard className="w-full h-full" />
    },
    {
      id: 'billing-history',
      name: 'Billing History',
      icon: <FileText className="w-full h-full" />
    },
    {
      id: 'ai-credit-history',
      name: 'AI Credit History',
      icon: <Zap className="w-full h-full" />
    },
    {
      id: 'quick-stats',
      name: 'Quick Stats',
      icon: <TrendingUp className="w-full h-full" />
    }
  ];

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      });
      setActiveSection(sectionId);
    }
  };

  if (isStacked) {
    return (
      <div className="flex flex-col h-full">
        {/* Toggle Button */}
        {canToggle && (
          <button
            onClick={onToggleExpansion}
            className="flex items-center justify-center h-16 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Stacked Icons */}
        <div className="flex-1 py-4">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`w-full flex items-center justify-center h-12 mx-2 mb-2 rounded-lg transition-all duration-200 ${
                activeSection === section.id
                  ? 'bg-[#6C60FF]/10 text-[#6C60FF]'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              title={section.name}
            >
              <div className="w-5 h-5">
                {section.icon}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Billing & Payments</h2>
        </div>
        {canToggle && (
          <button
            onClick={onToggleExpansion}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">Jump to section</p>

          <nav className="space-y-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 relative ${
                  activeSection === section.id
                    ? 'bg-[#6C60FF]/10 text-[#6C60FF] border border-[#6C60FF]/20'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className={`w-5 h-5 ${
                  activeSection === section.id ? 'text-[#6C60FF]' : 'text-gray-500'
                }`}>
                  {section.icon}
                </div>
                <span className="font-medium">{section.name}</span>
                {activeSection === section.id && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-[#6C60FF] rounded-l-full"></div>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
