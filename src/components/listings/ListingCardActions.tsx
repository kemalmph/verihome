"use client";

import { useState } from "react";
import { SaveButton } from "./SaveButton";
import { LoginModal } from "@/components/auth/LoginModal";

interface ListingCardActionsProps {
  propertyId: string;
  initialSaved: boolean;
}

export function ListingCardActions({ propertyId, initialSaved }: ListingCardActionsProps) {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <SaveButton
        propertyId={propertyId}
        initialSaved={initialSaved}
        onLoginRequired={() => setShowLogin(true)}
        size="sm"
      />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
