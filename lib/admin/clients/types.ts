export type AdminClientSearchItem = {
  clientId: number;
  name: string;
  phone: string;
};

export type SearchAdminClientsInput = {
  query: string;
  limit: number;
};

export type SearchAdminClientsResponse = {
  query: string;
  total: number;
  clients: AdminClientSearchItem[];
};
