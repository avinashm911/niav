import { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import type { Auth } from "../lib/api";

export function useSession() {
  const [baseUrl, setBaseUrl] = useState("http://10.0.2.2:3000");
  const [auth, setAuth] = useState<Auth | null>(null);
  return { baseUrl, setBaseUrl, auth, setAuth };
}

export function SignInScreen({ baseUrl, onAuth }: { baseUrl: string; onAuth: (a: Auth) => void }) {
  const [userId, setUserId] = useState("u-owner");
  const [companyId, setCompanyId] = useState("c1");
  void baseUrl;
  return (
    <View>
      <Text>NiavERP sign in (dev trust; Supabase Auth plugs in here)</Text>
      <TextInput value={userId} onChangeText={setUserId} placeholder="user id" />
      <TextInput value={companyId} onChangeText={setCompanyId} placeholder="company id" />
      <Button title="Sign in" onPress={() => onAuth({ userId, companyId, deviceId: "android-dev-1" })} />
    </View>
  );
}
