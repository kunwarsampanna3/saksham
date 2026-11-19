-- Card payments from abroad (Visa / Mastercard / dollar card). Sandbox only until a licensed gateway is connected.
alter type pay_method add value if not exists 'card_sandbox';
