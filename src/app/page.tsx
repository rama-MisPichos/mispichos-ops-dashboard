"use client";

import { useEffect, useState } from "react";
import DashboardClient from "@/app/components/DashboardClient";
import LoginPage from "@/app/components/LoginPage";

export default function Page() {
  const [auth, setAuth] = useState<boolean | null>(null);

  useEffect(() => {
    setAuth(sessionStorage.getItem("ops:auth") === "1");
  }, []);

  // evita flash antes de leer sessionStorage
  if (auth === null) return null;

  if (!auth) {
    return <LoginPage onSuccess={() => setAuth(true)} />;
  }

  return <DashboardClient />;
}
