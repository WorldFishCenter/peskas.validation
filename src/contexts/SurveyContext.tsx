import React, { createContext, useContext, useState } from 'react';

interface SurveyContextValue {
  selectedSurveyId: string | null;
  setSelectedSurveyId: (id: string | null) => void;
}

const SurveyContext = createContext<SurveyContextValue>({
  selectedSurveyId: null,
  setSelectedSurveyId: () => {}
});

export const SurveyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  return (
    <SurveyContext.Provider value={{ selectedSurveyId, setSelectedSurveyId }}>
      {children}
    </SurveyContext.Provider>
  );
};

export const useSurveyContext = () => useContext(SurveyContext);
