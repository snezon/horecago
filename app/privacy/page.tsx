export const metadata = {
  title: "Обработка персональных данных — HoReCaGo",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <div className="text-xs uppercase tracking-wide text-ink-500 mb-1">Политика</div>
        <h1 className="text-3xl font-bold mb-2">Обработка персональных данных</h1>
        <p className="text-sm italic text-ink-500">
          Это рабочая версия документа — точные реквизиты оператора появятся здесь позже.
        </p>
      </div>

      <section className="card space-y-2">
        <h2 className="section-title">Кто оператор</h2>
        <p className="text-sm text-ink-700">
          Оператором обработки персональных данных является сервис HoReCaGo.
          По всем вопросам, связанным с обработкой ваших данных, можно написать
          на <a href="mailto:privacy@horecago.tech" className="underline">privacy@horecago.tech</a>.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="section-title">Какие данные мы собираем</h2>
        <p className="text-sm text-ink-700">
          Имя, телефон, адрес электронной почты, район проживания, сведения о
          квалификации, а также загруженные вами документы — паспорт и
          медицинская книжка.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="section-title">Зачем мы это делаем</h2>
        <p className="text-sm text-ink-700">
          Чтобы подбирать вам подходящие смены, подтверждать допуск к работе и
          обеспечивать связь между вами, заказчиком смены и агентством, которое
          вас представляет.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="section-title">Кому мы передаём данные</h2>
        <p className="text-sm text-ink-700">
          Только заказчику, к смене которого вы проявили интерес, и агентству,
          которое вас представляет. Никаким иным третьим лицам ваши данные не
          передаются.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="section-title">Сколько мы храним данные</h2>
        <p className="text-sm text-ink-700">
          Пока ваша учётная запись активна.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="section-title">Ваши права</h2>
        <p className="text-sm text-ink-700">
          Отозвать представительство агентства можно самостоятельно в личном
          кабинете. Отзыв согласия на обработку данных и удаление данных —
          по письменному обращению на указанный адрес.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="section-title">Как отозвать согласие</h2>
        <p className="text-sm text-ink-700">
          Напишите письмо на <a href="mailto:privacy@horecago.tech" className="underline">privacy@horecago.tech</a> —
          мы прекратим обработку и удалим данные по вашему запросу. Отзыв
          представительства агентства эта переписка не заменяет — он
          выполняется в личном кабинете.
        </p>
      </section>
    </div>
  );
}
