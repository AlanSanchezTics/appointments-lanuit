import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookAppointmentModal } from "@/components/admin/months/BookAppointmentModal";

describe("BookAppointmentModal", () => {
  it("renders submit button and triggers submit callback", () => {
    const onSubmit = vi.fn();

    render(
      <BookAppointmentModal
        isOpen
        isLoadingDays={false}
        isSubmitting={false}
        isReadyToSubmit
        errorCode={null}
        fieldErrors={{}}
        days={[
          {
            date: "2026-03-21",
            slots: ["10:00", "14:00"],
          },
        ]}
        selectedDate="2026-03-21"
        selectedDaySlots={["10:00", "14:00"]}
        selectedTimeSlot="10:00"
        clientMode="new"
        searchQuery=""
        searchResults={[]}
        isSearchingClients={false}
        selectedClient={null}
        newClientName="Maria Perez"
        newClientPhone="5511112233"
        newClientNumber="1001"
        successResult={null}
        onClose={vi.fn()}
        onSelectDate={vi.fn()}
        onSelectTimeSlot={vi.fn()}
        onChangeClientMode={vi.fn()}
        onSearchQueryChange={vi.fn()}
        onSelectClient={vi.fn()}
        onNewClientNameChange={vi.fn()}
        onNewClientPhoneChange={vi.fn()}
        onNewClientNumberChange={vi.fn()}
        onSubmit={onSubmit}
        onBackFromSuccess={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Agendar cita" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders success panel and triggers back action", () => {
    const onBackFromSuccess = vi.fn();

    render(
      <BookAppointmentModal
        isOpen
        isLoadingDays={false}
        isSubmitting={false}
        isReadyToSubmit={false}
        errorCode={null}
        fieldErrors={{}}
        days={[]}
        selectedDate={null}
        selectedDaySlots={[]}
        selectedTimeSlot={null}
        clientMode="existing"
        searchQuery=""
        searchResults={[]}
        isSearchingClients={false}
        selectedClient={null}
        newClientName=""
        newClientPhone=""
        newClientNumber=""
        successResult={{
          appointmentId: 1,
          date: "2026-03-13",
          timeSlot: "10:00",
          status: "CONFIRMED",
          client: {
            clientId: 1,
            clientNumber: 1001,
            name: "Ana Garcia",
            phone: "5512345678",
          },
        }}
        onClose={vi.fn()}
        onSelectDate={vi.fn()}
        onSelectTimeSlot={vi.fn()}
        onChangeClientMode={vi.fn()}
        onSearchQueryChange={vi.fn()}
        onSelectClient={vi.fn()}
        onNewClientNameChange={vi.fn()}
        onNewClientPhoneChange={vi.fn()}
        onNewClientNumberChange={vi.fn()}
        onSubmit={vi.fn()}
        onBackFromSuccess={onBackFromSuccess}
      />,
    );

    expect(screen.getByText("¡Cita Confirmada!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(onBackFromSuccess).toHaveBeenCalledTimes(1);
  });

  it("does not render inline API error copy in the modal", () => {
    render(
      <BookAppointmentModal
        isOpen
        isLoadingDays={false}
        isSubmitting={false}
        isReadyToSubmit={false}
        errorCode="PHONE_ALREADY_BOOKED"
        fieldErrors={{}}
        days={[]}
        selectedDate={null}
        selectedDaySlots={[]}
        selectedTimeSlot={null}
        clientMode="existing"
        searchQuery=""
        searchResults={[]}
        isSearchingClients={false}
        selectedClient={null}
        newClientName=""
        newClientPhone=""
        newClientNumber=""
        successResult={null}
        onClose={vi.fn()}
        onSelectDate={vi.fn()}
        onSelectTimeSlot={vi.fn()}
        onChangeClientMode={vi.fn()}
        onSearchQueryChange={vi.fn()}
        onSelectClient={vi.fn()}
        onNewClientNameChange={vi.fn()}
        onNewClientPhoneChange={vi.fn()}
        onNewClientNumberChange={vi.fn()}
        onSubmit={vi.fn()}
        onBackFromSuccess={vi.fn()}
      />,
    );

    expect(
      screen.queryByText(
        "No se pudo agendar la cita porque esta clienta ya tiene una cita programada a futuro.",
      ),
    ).not.toBeInTheDocument();
  });
});
