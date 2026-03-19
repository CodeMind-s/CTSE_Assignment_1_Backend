import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BoardType {
  FULL = 'full',
  HALF = 'half',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  guestId: string;

  @Column()
  roomId: string;

  @Column({ default: '' })
  hostId: string;

  @Column({ type: 'date' })
  reservationDate: string;

  @Column({ type: 'time' })
  checkInTime: string;

  @Column({ type: 'time' })
  checkOutTime: string;

  @Column({ default: 1 })
  memberCount: number;

  @Column({ type: 'enum', enum: BoardType, default: BoardType.FULL })
  board: BoardType;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
