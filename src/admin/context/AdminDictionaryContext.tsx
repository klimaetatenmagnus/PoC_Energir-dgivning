/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  type PropsWithChildren,
} from "react";
import type { AdminDictionaryContextValue } from "../types";
import { useContentDictionary } from "../hooks/useContentDictionary";

const AdminDictionaryContext = createContext<
  AdminDictionaryContextValue | undefined
>(undefined);

export function AdminDictionaryProvider({ children }: PropsWithChildren) {
  const value = useContentDictionary();
  return (
    <AdminDictionaryContext.Provider value={value}>
      {children}
    </AdminDictionaryContext.Provider>
  );
}

export function useAdminDictionary(): AdminDictionaryContextValue {
  const context = useContext(AdminDictionaryContext);
  if (!context) {
    throw new Error(
      "useAdminDictionary må brukes innenfor AdminDictionaryProvider"
    );
  }
  return context;
}
