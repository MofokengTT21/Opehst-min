import React, { createContext, useContext, useState, ReactNode } from 'react';

type HubContextType = {
  activeHubId: string;
  setActiveHubId: (id: string) => void;
};

const HubContext = createContext<HubContextType | undefined>(undefined);

export const HubProvider = ({ children }: { children: ReactNode }) => {
  const [activeHubId, setActiveHubId] = useState<string>('all');

  return (
    <HubContext.Provider value={{ activeHubId, setActiveHubId }}>
      {children}
    </HubContext.Provider>
  );
};

export const useHubContext = () => {
  const context = useContext(HubContext);
  if (!context) {
    throw new Error('useHubContext must be used within a HubProvider');
  }
  return context;
};
