import React, { createContext, useContext, useState } from 'react';

interface SurveyContextValue {
  selectedSurveyId: string | null;
  /**
   * Sets the shared id and nothing else.
   *
   * This does **not** load the survey: `useFetchSubmissions` / `useFetchEnumeratorStats` read the
   * survey from a ref, not from this context, so a bare set leaves the screen showing the previous
   * survey's rows. Screens must call `selectSurvey` from those hooks instead, which does both.
   * This setter exists for the hooks themselves, which use it to publish a survey they auto-selected.
   */
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
