// Stub store - Checkout not available in open source version
import { create } from 'zustand';

interface CheckoutStore {
  isLoading: boolean;
  startCheckout: () => Promise<void>;
}

export const useCheckoutStore = create<CheckoutStore>((set) => ({
  isLoading: false,
  startCheckout: async () => {
    throw new Error('Checkout not available in open source version');
  },
}));
