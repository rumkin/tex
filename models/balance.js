function createBalance({
  token,
  owner,
  amount = 0,
  available = 0,
  createdAt = new Date(),
  updatedAt = new Date(),
  deletedAt = null,
}) {
  return {
    token,
    owner,
    amount,
    available,
    createdAt,
    updatedAt,
    deletedAt,
  };
}

exports.createBalance = createBalance;
