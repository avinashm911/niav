import { useState } from "react";
import { Button, FlatList, Text, TextInput, View } from "react-native";
import { command, newSource, type Auth } from "../lib/api";

// Parties screen: list via read + create via party.create. No balances here
// (outstanding lives in History/Payments reads from the server).
export function PartiesScreen({ baseUrl, auth }: { baseUrl: string; auth: Auth }) {
  const [name, setName] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const create = async (role: "customer" | "supplier") => {
    try {
      const out = await command<{ id: string }>(baseUrl, auth, "party.create", {
        id: newSource("party"), name, roles: [role],
      });
      setLog((l) => [`created ${role} ${out.id}`, ...l]);
      setName("");
    } catch (e) {
      setLog((l) => [`ERR ${e instanceof Error ? e.message : e}`, ...l]);
    }
  };
  return (
    <View>
      <Text>Parties</Text>
      <TextInput value={name} onChangeText={setName} placeholder="party name" />
      <Button title="Add customer" onPress={() => void create("customer")} />
      <Button title="Add supplier" onPress={() => void create("supplier")} />
      <FlatList data={log} keyExtractor={(x, i) => `${i}-${x}`} renderItem={({ item }) => <Text>{item}</Text>} />
    </View>
  );
}

// Items screen: master capture only. Stock truth stays server-side.
export function ItemsScreen({ baseUrl, auth }: { baseUrl: string; auth: Auth }) {
  const [name, setName] = useState("");
  const [log, setLog] = useState("");
  const create = async () => {
    try {
      const out = await command<{ id: string }>(baseUrl, auth, "item.create", { id: newSource("item"), name });
      setLog(`created ${out.id}`);
      setName("");
    } catch (e) {
      setLog(`ERR ${e instanceof Error ? e.message : e}`);
    }
  };
  return (
    <View>
      <Text>Items</Text>
      <TextInput value={name} onChangeText={setName} placeholder="item name" />
      <Button title="Add item" onPress={() => void create()} />
      <Text>{log}</Text>
    </View>
  );
}

// Locations screen: named places; warehouse is a flag, not a second system.
export function LocationsScreen({ baseUrl, auth }: { baseUrl: string; auth: Auth }) {
  const [name, setName] = useState("");
  const [log, setLog] = useState("");
  const create = async (warehouse: boolean) => {
    try {
      const out = await command<{ id: string }>(baseUrl, auth, "location.create", { id: newSource("loc"), name, warehouse });
      setLog(`created ${out.id}`);
      setName("");
    } catch (e) {
      setLog(`ERR ${e instanceof Error ? e.message : e}`);
    }
  };
  return (
    <View>
      <Text>Locations</Text>
      <TextInput value={name} onChangeText={setName} placeholder="location name" />
      <Button title="Add shop" onPress={() => void create(false)} />
      <Button title="Add godown" onPress={() => void create(true)} />
      <Text>{log}</Text>
    </View>
  );
}
